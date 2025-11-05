"""
Database models using SQLAlchemy
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, BigInteger, ForeignKey, Text, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from database import db
import uuid

def generate_uuid():
    """Generate UUID as string"""
    return str(uuid.uuid4())

class User(db.Model):
    """User model"""
    __tablename__ = 'users'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False)
    supabase_uid = Column(String, unique=True, nullable=True)  # Supabase user ID for faster lookups
    name = Column(String, nullable=True)
    password = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Index for Supabase UID lookups (faster than email)
    __table_args__ = (
        Index('idx_user_supabase_uid', 'supabase_uid'),
    )
    
    # Relationships
    data_rooms = relationship('DataRoom', back_populates='owner', cascade='all, delete-orphan')
    folders = relationship('Folder', back_populates='user', cascade='all, delete-orphan')
    files = relationship('File', back_populates='user', cascade='all, delete-orphan')
    google_drive_token = relationship('GoogleDriveToken', back_populates='user', uselist=False, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'email': self.email,
            'name': self.name,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),
        }


class GoogleDriveToken(db.Model):
    """Google Drive OAuth token model"""
    __tablename__ = 'google_drive_tokens'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship('User', back_populates='google_drive_token')


class DataRoom(db.Model):
    """Data room model"""
    __tablename__ = 'data_rooms'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Unique constraint: name must be unique per user
    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='uq_data_room_user_name'),
        Index('idx_data_room_user_name', 'user_id', 'name'),
        Index('idx_data_room_user_id', 'user_id'),  # Fast ownership checks
    )
    
    # Relationships
    owner = relationship('User', back_populates='data_rooms')
    files = relationship('File', back_populates='data_room', cascade='all, delete-orphan')
    folders = relationship('Folder', back_populates='data_room', cascade='all, delete-orphan')
    
    def to_dict(self, include_counts=False):
        result = {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'ownerId': str(self.user_id),
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),
        }
        if include_counts:
            result['_count'] = {
                'folders': len(self.folders),
                'files': len(self.files),
            }
        return result


class Folder(db.Model):
    """Folder model"""
    __tablename__ = 'folders'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    data_room_id = Column(String, ForeignKey('data_rooms.id', ondelete='CASCADE'), nullable=False)
    parent_folder_id = Column(String, ForeignKey('folders.id', ondelete='CASCADE'), nullable=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Unique constraint: name must be unique per parent folder (or per data room if root)
    # Case-insensitive uniqueness using lower(name)
    # For PostgreSQL, we use concatenation with delimiter to create composite unique key
    # This ensures folders with the same name can exist in different parent folders
    # and at the root level, but not duplicates within the same location (case-insensitive)
    __table_args__ = (
        # Composite unique constraint: concatenate data_room_id, parent_folder_id (or ''), and lower(name)
        # Using concatenation with delimiter since PostgreSQL doesn't support tuple expressions in functional indexes
        Index('idx_folder_unique', 
              db.text("(data_room_id::text || '|' || COALESCE(parent_folder_id::text, '') || '|' || lower(name))"), 
              unique=True,
              postgresql_ops={}),
        Index('idx_folder_parent_name', 'parent_folder_id', 'name', 'data_room_id'),
        # Composite index for conflict check optimization - stops scanning when searching by dataRoomId, parentId, name
        Index('idx_folder_name_scope', 'data_room_id', 'parent_folder_id', 'name'),
    )
    
    # Relationships
    data_room = relationship('DataRoom', back_populates='folders')
    user = relationship('User', back_populates='folders')
    parent = relationship('Folder', remote_side=[id], backref='children')
    files = relationship('File', back_populates='folder', cascade='all, delete-orphan')
    
    def to_dict(self, include_counts=False):
        result = {
            'id': str(self.id),
            'name': self.name,
            'dataRoomId': str(self.data_room_id),
            'parentId': str(self.parent_folder_id) if self.parent_folder_id else None,
            'userId': str(self.user_id),
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),
        }
        if include_counts:
            result['_count'] = {
                'children': len(self.children),
                'files': len(self.files),
            }
        return result


class File(db.Model):
    """File model"""
    __tablename__ = 'files'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    data_room_id = Column(String, ForeignKey('data_rooms.id', ondelete='CASCADE'), nullable=False)
    folder_id = Column(String, ForeignKey('folders.id', ondelete='CASCADE'), nullable=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    file_size = Column(BigInteger, nullable=True)
    mime_type = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Unique constraint: name must be unique per folder (or per data room if root)
    # Case-insensitive uniqueness using lower(name)
    # For PostgreSQL, we use concatenation with delimiter to create composite unique key
    # Similar to folders, we handle NULL folder_id (root files) separately
    __table_args__ = (
        # Composite unique constraint: concatenate data_room_id, folder_id (or ''), and lower(name)
        # Using concatenation with delimiter since PostgreSQL doesn't support tuple expressions in functional indexes
        Index('idx_file_unique', 
              db.text("(data_room_id::text || '|' || COALESCE(folder_id::text, '') || '|' || lower(name))"), 
              unique=True,
              postgresql_ops={}),
        Index('idx_file_folder_name', 'folder_id', 'name', 'data_room_id'),
        # Composite index for conflict check optimization - stops scanning when searching by dataRoomId, folderId, name
        Index('idx_file_name_scope', 'data_room_id', 'folder_id', 'name'),
    )
    
    # Relationships
    data_room = relationship('DataRoom', back_populates='files')
    folder = relationship('Folder', back_populates='files')
    user = relationship('User', back_populates='files')
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'dataRoomId': str(self.data_room_id),
            'folderId': str(self.folder_id) if self.folder_id else None,
            'userId': str(self.user_id),
            'fileSize': str(self.file_size) if self.file_size else None,
            'mimeType': self.mime_type,
            'filePath': self.file_path,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),
        }

