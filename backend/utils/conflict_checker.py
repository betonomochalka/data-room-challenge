"""
Conflict checking utilities
Optimized to use single database queries where possible
"""
from database import db
from models import Folder, File
from middleware.error_handler import create_error
from sqlalchemy import and_

def check_name_conflicts(name: str, data_room_id: str, folder_id: str = None, 
                        exclude_file_id: str = None, exclude_folder_id: str = None) -> dict:
    """Check for name conflicts in a specific location using optimized EXISTS queries"""
    conflicting_folder = None
    conflicting_file = None
    
    # Use EXISTS subqueries for better performance - these are optimized by PostgreSQL
    # to stop as soon as a match is found
    folder_filter = and_(
        Folder.name == name,
        Folder.parent_folder_id == folder_id,
        Folder.data_room_id == data_room_id
    )
    if exclude_folder_id:
        folder_filter = and_(folder_filter, Folder.id != exclude_folder_id)
    
    folder_exists = db.session.query(
        db.session.query(Folder.id).filter(folder_filter).exists()
    ).scalar()
    
    file_filter = and_(
        File.name == name,
        File.folder_id == folder_id,
        File.data_room_id == data_room_id
    )
    if exclude_file_id:
        file_filter = and_(file_filter, File.id != exclude_file_id)
    
    file_exists = db.session.query(
        db.session.query(File.id).filter(file_filter).exists()
    ).scalar()
    
    # Only fetch full objects if conflicts exist (for detailed error messages)
    # This avoids unnecessary object loading when there are no conflicts
    if folder_exists:
        conflicting_folder = Folder.query.filter(folder_filter).first()
    
    if file_exists:
        conflicting_file = File.query.filter(file_filter).first()
    
    return {
        'folderConflict': conflicting_folder is not None,
        'fileConflict': conflicting_file is not None,
        'conflictingFolder': conflicting_folder.to_dict() if conflicting_folder else None,
        'conflictingFile': conflicting_file.to_dict() if conflicting_file else None
    }

def check_and_throw_conflicts(name: str, data_room_id, folder_id=None, 
                              exclude_file_id=None, exclude_folder_id=None):
    """Check for conflicts and throw appropriate errors"""
    conflicts = check_name_conflicts(name, data_room_id, folder_id, exclude_file_id, exclude_folder_id)
    
    if conflicts['folderConflict']:
        raise create_error('A folder with this name already exists in this location', 409)
    
    if conflicts['fileConflict']:
        raise create_error('A file with this name already exists in this location', 409)

