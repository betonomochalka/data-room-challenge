"""
Data room routes
"""
from flask import Blueprint, request, jsonify, g
from marshmallow import Schema, fields, ValidationError
from database import db
from models import DataRoom
from middleware.auth import authenticate_token
from middleware.error_handler import create_error
from utils.performance_monitor import start_request_timing, end_request_timing, record_stats

bp = Blueprint('data_rooms', __name__)

class DataRoomSchema(Schema):
    name = fields.Str(required=True, validate=lambda x: 3 <= len(x) <= 100)

@bp.route('', methods=['GET'])
@authenticate_token
def get_data_rooms():
    """Get the user's Data Room (create if doesn't exist)"""
    # Get or create single Data Room for user
    data_room = DataRoom.query.filter_by(user_id=g.user.id).first()
    
    if not data_room:
        # Create default Data Room if it doesn't exist
        user_name = g.user.name or g.user.email.split('@')[0]
        # Remove nickname in parentheses if present
        import re
        user_name = re.sub(r'\s*\([^)]*\)\s*$', '', user_name).strip() if user_name else user_name
        data_room = DataRoom(
            name=f'Data Room ({user_name})',
            user_id=g.user.id
        )
        db.session.add(data_room)
        db.session.commit()
    
    response_data = {
        'success': True,
        'data': data_room.to_dict(include_counts=True)
    }
    
    return jsonify(response_data), 200

@bp.route('', methods=['POST'])
@authenticate_token
def create_data_room():
    """Update the user's Data Room name"""
    schema = DataRoomSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400
    
    name = data['name']
    
    try:
        # Get or create Data Room
        data_room = DataRoom.query.filter_by(user_id=g.user.id).first()
        
        if not data_room:
            # Create if doesn't exist
            data_room = DataRoom(
                name=name,
                user_id=g.user.id
            )
            db.session.add(data_room)
        else:
            # Update name if exists
            data_room.name = name
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': data_room.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        raise

@bp.route('/<string:id>', methods=['GET'])
@authenticate_token
def get_data_room(id):
    """Get a single data room by ID - optimized to use ~4 queries"""
    # Start performance monitoring
    start_request_timing()
    
    try:
        # Query 1: Get data room
        data_room = DataRoom.query.filter_by(id=id, user_id=g.user.id).first()
        
        if not data_room:
            raise create_error('Data room not found', 404)
        
        # Query 2: Get root folders with counts using subqueries (no N+1)
        from models import Folder, File
        from sqlalchemy import func
        
        # Subquery for children counts per folder
        child_count_subq = db.session.query(
            Folder.parent_folder_id,
            func.count(Folder.id).label('child_count')
        ).group_by(Folder.parent_folder_id).subquery()
        
        # Subquery for file counts per folder
        file_count_subq = db.session.query(
            File.folder_id,
            func.count(File.id).label('file_count')
        ).group_by(File.folder_id).subquery()
        
        # Single optimized query: Get root folders with counts
        root_folders_with_counts = db.session.query(
            Folder,
            func.coalesce(child_count_subq.c.child_count, 0).label('child_count'),
            func.coalesce(file_count_subq.c.file_count, 0).label('file_count')
        ).outerjoin(
            child_count_subq, Folder.id == child_count_subq.c.parent_folder_id
        ).outerjoin(
            file_count_subq, Folder.id == file_count_subq.c.folder_id
        ).filter(
            Folder.data_room_id == id,
            Folder.parent_folder_id.is_(None)
        ).order_by(Folder.name.asc()).all()
        
        # Query 3: Get root files (single query)
        root_files_data = File.query.filter_by(
            data_room_id=id,
            folder_id=None
        ).order_by(File.name.asc()).all()
        
        # Build response with field filtering
        requested_fields = request.args.get('fields', '').split(',') if request.args.get('fields') else None
        
        # Build data room dict
        result = {}
        if not requested_fields or 'id' in requested_fields:
            result['id'] = str(data_room.id)
        if not requested_fields or 'name' in requested_fields:
            result['name'] = data_room.name
        if not requested_fields or 'description' in requested_fields:
            result['description'] = data_room.description
        if not requested_fields or 'ownerId' in requested_fields:
            result['ownerId'] = str(data_room.user_id)
        if not requested_fields or 'createdAt' in requested_fields:
            result['createdAt'] = data_room.created_at.isoformat()
        if not requested_fields or 'updatedAt' in requested_fields:
            result['updatedAt'] = data_room.updated_at.isoformat()
        if not requested_fields or '_count' in requested_fields:
            # Count totals (already have folder counts, just need file count)
            total_files = len(root_files_data)
            result['_count'] = {
                'folders': len(root_folders_with_counts),
                'files': total_files
            }
        
        # Build folders list with counts (no additional queries)
        folders = []
        for folder_obj, child_count, file_count in root_folders_with_counts:
            folder_dict = {}
            if not requested_fields or 'id' in requested_fields:
                folder_dict['id'] = str(folder_obj.id)
            if not requested_fields or 'name' in requested_fields:
                folder_dict['name'] = folder_obj.name
            if not requested_fields or 'parentId' in requested_fields:
                folder_dict['parentId'] = str(folder_obj.parent_folder_id) if folder_obj.parent_folder_id else None
            if not requested_fields or 'dataRoomId' in requested_fields:
                folder_dict['dataRoomId'] = str(folder_obj.data_room_id)
            if not requested_fields or 'userId' in requested_fields:
                folder_dict['userId'] = str(folder_obj.user_id)
            if not requested_fields or 'createdAt' in requested_fields:
                folder_dict['createdAt'] = folder_obj.created_at.isoformat()
            if not requested_fields or 'updatedAt' in requested_fields:
                folder_dict['updatedAt'] = folder_obj.updated_at.isoformat()
            if not requested_fields or '_count' in requested_fields:
                folder_dict['_count'] = {
                    'children': int(child_count),
                    'files': int(file_count)
                }
            folders.append(folder_dict)
        
        # Build files list
        files = []
        for f in root_files_data:
            file_dict = {}
            if not requested_fields or 'id' in requested_fields:
                file_dict['id'] = str(f.id)
            if not requested_fields or 'name' in requested_fields:
                file_dict['name'] = f.name
            if not requested_fields or 'dataRoomId' in requested_fields:
                file_dict['dataRoomId'] = str(f.data_room_id)
            if not requested_fields or 'folderId' in requested_fields:
                file_dict['folderId'] = str(f.folder_id) if f.folder_id else None
            if not requested_fields or 'userId' in requested_fields:
                file_dict['userId'] = str(f.user_id)
            if not requested_fields or 'fileSize' in requested_fields:
                file_dict['fileSize'] = str(f.file_size) if f.file_size else None
            if not requested_fields or 'mimeType' in requested_fields:
                file_dict['mimeType'] = f.mime_type
            if not requested_fields or 'filePath' in requested_fields:
                file_dict['filePath'] = f.file_path
            if not requested_fields or 'createdAt' in requested_fields:
                file_dict['createdAt'] = f.created_at.isoformat()
            if not requested_fields or 'updatedAt' in requested_fields:
                file_dict['updatedAt'] = f.updated_at.isoformat()
            files.append(file_dict)
        
        result['folders'] = folders
        result['files'] = files
        
        response_data = {
            'success': True,
            'data': result
        }
        
        return jsonify(response_data), 200
    finally:
        # End performance monitoring and record stats
        stats = end_request_timing()
        if stats:
            record_stats(stats)
            # Log current request stats
            print(f"[Performance] Data room endpoint - Total: {stats['total_time_ms']:.2f}ms, "
                  f"Queries: {stats['query_count']}, Query Time: {stats['total_query_time_ms']:.2f}ms")

@bp.route('/<string:id>', methods=['PUT'])
@authenticate_token
def update_data_room(id):
    """Update a data room"""
    schema = DataRoomSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400
    
    try:
        data_room = DataRoom.query.filter_by(id=id, user_id=g.user.id).first()
        
        if not data_room:
            raise create_error('Data room not found', 404)
        
        data_room.name = data['name']
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': data_room.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        raise

@bp.route('/<string:id>', methods=['DELETE'])
@authenticate_token
def delete_data_room(id):
    """Delete a data room (not allowed - user must have at least one)"""
    raise create_error('Cannot delete Data Room. Every user must have at least one Data Room.', 403)

