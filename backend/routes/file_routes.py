"""
File routes
"""
from flask import Blueprint, request, jsonify, g, redirect
from werkzeug.utils import secure_filename
from database import db
from models import File, DataRoom, Folder
from middleware.auth import authenticate_token
from middleware.error_handler import create_error
from utils.supabase_storage import upload_file as upload_to_supabase, delete_file as delete_supabase_file, get_signed_url, create_signed_upload_url
from utils.file_validation import validate_file_type
from sqlalchemy.exc import IntegrityError
from utils.performance_monitor import start_request_timing, end_request_timing, record_stats
from config import Config

bp = Blueprint('files', __name__)

@bp.route('', methods=['GET'])
@authenticate_token
def get_files():
    """Get files filtered by dataRoomId or folderId"""
    data_room_id = request.args.get('dataRoomId')
    folder_id = request.args.get('folderId')
    
    if not data_room_id and not folder_id:
        raise create_error('Either dataRoomId or folderId is required', 400)
    
    query = File.query.filter_by(user_id=g.user.id)
    
    if folder_id:
        query = query.filter_by(folder_id=folder_id)
    elif data_room_id:
        query = query.filter_by(data_room_id=data_room_id)
    
    files = query.order_by(File.created_at.desc()).all()
    
    response_data = {
        'success': True,
        'data': [f.to_dict() for f in files]
    }
    
    return jsonify(response_data), 200

@bp.route('/<string:id>/view', methods=['GET'])
@authenticate_token
def view_file(id):
    """Get signed URL for file viewing"""
    file = File.query.filter_by(id=id, user_id=g.user.id).first()
    
    if not file:
        raise create_error('File not found', 404)
    
    if not file.file_path:
        raise create_error('File path not available', 500)
    
    signed_url = get_signed_url(file.file_path)
    return redirect(signed_url)

@bp.route('/<string:id>', methods=['PUT'])
@authenticate_token
def update_file(id):
    """Update file metadata (rename)"""
    start_request_timing()
    
    try:
        data = request.json
        name = data.get('name')
        
        if not name:
            raise create_error('Name is required', 400)
        
        # Single query: get file (already validates user ownership)
        file = File.query.filter_by(id=id, user_id=g.user.id).first()
        
        if not file:
            raise create_error('File not found', 404)
        
        # Update name - unique constraint will catch conflicts automatically
        # No need for manual conflict check - database enforces uniqueness
        file.name = name
        db.session.commit()
        
        # Return trimmed response (just id, name, folderId, dataRoomId)
        # No extra fields - keeps response lightweight and avoids extra queries
        return jsonify({
            'success': True,
            'data': {
                'id': file.id,
                'name': file.name,
                'folderId': file.folder_id,
                'dataRoomId': file.data_room_id
            }
        }), 200
    except IntegrityError as e:
        # Unique constraint violation - database caught the conflict
        db.session.rollback()
        error_str = str(e.orig) if hasattr(e, 'orig') else str(e)
        if 'idx_file_unique' in error_str:
            raise create_error('A file with this name already exists in this location', 409)
        raise  # Re-raise other integrity errors
    except Exception as e:
        db.session.rollback()
        raise
    finally:
        stats = end_request_timing()
        if stats:
            record_stats(stats)
            print(f"[Performance] Update file - Total: {stats['total_time_ms']:.2f}ms, "
                  f"Queries: {stats['query_count']}, Query Time: {stats['total_query_time_ms']:.2f}ms")

@bp.route('/upload-url', methods=['POST'])
@authenticate_token
def get_upload_url():
    """Get signed URL for direct file upload to storage"""
    start_request_timing()
    
    try:
        data = request.json
        file_name = data.get('fileName')
        data_room_id = data.get('dataRoomId')
        folder_id = data.get('folderId')
        
        if not file_name or not data_room_id:
            raise create_error('fileName and dataRoomId are required', 400)
        
        # Single query: verify data room belongs to user
        data_room = DataRoom.query.filter_by(id=data_room_id, user_id=g.user.id).first()
        if not data_room:
            raise create_error('Data room not found', 404)
        
        # Validate file type (no database query needed)
        mime_type = data.get('mimeType', 'application/octet-stream')
        final_name = secure_filename(file_name)
        
        validation = validate_file_type(mime_type, final_name)
        if not validation['valid']:
            raise create_error(validation.get('error', 'Invalid file type'), 400)
        
        # Create signed upload URL (client uploads directly to storage)
        # Conflict checking will happen when creating the file record (database enforces uniqueness)
        upload_info = create_signed_upload_url(
            final_name,
            f'uploads/{g.user.id}',
            mime_type
        )
        
        return jsonify({
            'success': True,
            'data': upload_info
        }), 200
    finally:
        stats = end_request_timing()
        if stats:
            record_stats(stats)
            print(f"[Performance] Get upload URL - Total: {stats['total_time_ms']:.2f}ms, "
                  f"Queries: {stats['query_count']}, Query Time: {stats['total_query_time_ms']:.2f}ms")

@bp.route('/upload-complete', methods=['POST'])
@authenticate_token
def upload_complete():
    """Complete file upload after direct storage upload"""
    start_request_timing()
    
    try:
        data = request.json
        file_path = data.get('filePath')
        file_name = data.get('fileName')
        file_size = data.get('fileSize')
        mime_type = data.get('mimeType')
        data_room_id = data.get('dataRoomId')
        folder_id = data.get('folderId')
        
        if not all([file_path, file_name, file_size, mime_type, data_room_id]):
            raise create_error('Missing required fields', 400)
        
        # Single query: verify data room belongs to user
        data_room = DataRoom.query.filter_by(id=data_room_id, user_id=g.user.id).first()
        if not data_room:
            raise create_error('Data room not found', 404)
        
        # Check file size
        if file_size > Config.MAX_FILE_SIZE:
            raise create_error(
                f'File is too large. Maximum size is {Config.MAX_FILE_SIZE / (1024 * 1024):.1f}MB.',
                413
            )
        
        # Validate file type
        validation = validate_file_type(mime_type, file_name)
        if not validation['valid']:
            raise create_error(validation.get('error', 'Invalid file type'), 400)
        
        # Create file record (storage upload already complete)
        # Database unique constraint will catch conflicts automatically
        new_file = File(
            name=file_name,
            data_room_id=data_room_id,
            folder_id=folder_id,
            user_id=g.user.id,
            file_size=file_size,
            mime_type=mime_type,
            file_path=file_path
        )
        db.session.add(new_file)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': new_file.to_dict()
        }), 201
    except IntegrityError as e:
        # Unique constraint violation - database caught the conflict
        db.session.rollback()
        error_str = str(e.orig) if hasattr(e, 'orig') else str(e)
        if 'idx_file_unique' in error_str:
            raise create_error('A file with this name already exists in this location', 409)
        raise  # Re-raise other integrity errors
    finally:
        stats = end_request_timing()
        if stats:
            record_stats(stats)
            print(f"[Performance] Upload complete - Total: {stats['total_time_ms']:.2f}ms, "
                  f"Queries: {stats['query_count']}, Query Time: {stats['total_query_time_ms']:.2f}ms")

@bp.route('/upload', methods=['POST'])
@authenticate_token
def upload_file_route():
    """Upload a new file (legacy - still supported for compatibility)"""
    start_request_timing()
    
    try:
        if 'file' not in request.files:
            raise create_error('No file uploaded', 400)
        
        file = request.files['file']
        if file.filename == '':
            raise create_error('No file selected', 400)
        
        data_room_id = request.form.get('dataRoomId')
        folder_id = request.form.get('folderId')
        name = request.form.get('name')
        
        if not data_room_id:
            raise create_error('dataRoomId is required', 400)
        
        # Single query: verify data room belongs to user
        data_room = DataRoom.query.filter_by(id=data_room_id, user_id=g.user.id).first()
        if not data_room:
            raise create_error('Data room not found', 404)
        
        # Check file size (no database query needed)
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Reset to beginning
        
        if file_size > Config.MAX_FILE_SIZE:
            raise create_error(
                f'File is too large. Maximum size is {Config.MAX_FILE_SIZE / (1024 * 1024):.1f}MB.',
                413
            )
        
        # Validate file type (no database query needed)
        mime_type = file.content_type or 'application/octet-stream'
        final_name = name or secure_filename(file.filename)
        
        validation = validate_file_type(mime_type, final_name)
        if not validation['valid']:
            raise create_error(validation.get('error', 'Invalid file type'), 400)
        
        # Read file content
        file_content = file.read()
        
        # Upload to Supabase storage
        file_path = upload_to_supabase(
            file_content,
            final_name,
            f'uploads/{g.user.id}',
            mime_type
        )
        
        # Create file record
        # Database unique constraint will catch conflicts automatically
        new_file = File(
            name=final_name,
            data_room_id=data_room_id,
            folder_id=folder_id,
            user_id=g.user.id,
            file_size=file_size,
            mime_type=mime_type,
            file_path=file_path
        )
        db.session.add(new_file)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': new_file.to_dict()
        }), 201
    except IntegrityError as e:
        # Unique constraint violation - database caught the conflict
        db.session.rollback()
        error_str = str(e.orig) if hasattr(e, 'orig') else str(e)
        if 'idx_file_unique' in error_str:
            raise create_error('A file with this name already exists in this location', 409)
        raise  # Re-raise other integrity errors
    finally:
        stats = end_request_timing()
        if stats:
            record_stats(stats)
            print(f"[Performance] Upload file - Total: {stats['total_time_ms']:.2f}ms, "
                  f"Queries: {stats['query_count']}, Query Time: {stats['total_query_time_ms']:.2f}ms")

@bp.route('/<string:id>', methods=['DELETE'])
@authenticate_token
def delete_file(id):
    """Delete a file"""
    start_request_timing()
    
    try:
        file = File.query.filter_by(id=id, user_id=g.user.id).first()
        
        if not file:
            raise create_error('File not found', 404)
        
        # Store IDs before deletion for cache invalidation
        data_room_id = file.data_room_id
        folder_id = file.folder_id
        file_path = file.file_path
        
        # Delete from database first (fast operation)
        db.session.delete(file)
        db.session.commit()
        
        # Delete from storage asynchronously (off request path)
        # This prevents blocking the request on slow storage operations
        if file_path:
            try:
                # Fire and forget - storage deletion happens in background
                # In production, use a task queue (Celery, RQ, etc.)
                import threading
                def delete_async():
                    try:
                        delete_supabase_file(file_path)
                    except Exception as e:
                        print(f'Error deleting file from storage: {e}')
                
                threading.Thread(target=delete_async, daemon=True).start()
            except Exception as e:
                print(f'Error scheduling storage deletion: {e}')
        
        return '', 204
    except Exception as e:
        db.session.rollback()
        raise
    finally:
        stats = end_request_timing()
        if stats:
            record_stats(stats)
            print(f"[Performance] Delete file - Total: {stats['total_time_ms']:.2f}ms, "
                  f"Queries: {stats['query_count']}, Query Time: {stats['total_query_time_ms']:.2f}ms")

