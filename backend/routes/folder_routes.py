"""
Folder routes
"""
from flask import Blueprint, request, jsonify, g
from marshmallow import Schema, fields, ValidationError
from database import db
from models import Folder, DataRoom, File
from middleware.auth import authenticate_token
from middleware.error_handler import create_error
from utils.performance_monitor import start_request_timing, end_request_timing, record_stats
from utils.supabase_storage import delete_file as delete_supabase_file
from sqlalchemy.exc import IntegrityError

bp = Blueprint('folders', __name__)

class FolderCreationSchema(Schema):
    name = fields.Str(required=True, validate=lambda x: 1 <= len(x) <= 100)
    parentId = fields.Str(required=False, allow_none=True)
    dataRoomId = fields.Str(required=True)

class FolderRenameSchema(Schema):
    name = fields.Str(required=True, validate=lambda x: 1 <= len(x) <= 100)

class FolderMoveSchema(Schema):
    newParentId = fields.Str(required=False, allow_none=True)

@bp.route('', methods=['GET'])
@authenticate_token
def get_folders():
    """Get all folders for a data room"""
    data_room_id = request.args.get('dataRoomId')
    
    if not data_room_id:
        raise create_error('Data room ID is required', 400)
    
    # Verify data room belongs to user
    data_room = DataRoom.query.filter_by(id=data_room_id, user_id=g.user.id).first()
    if not data_room:
        raise create_error('Data room not found', 404)
    
    folders = Folder.query.filter_by(data_room_id=data_room_id).order_by(Folder.name.asc()).all()
    
    response_data = {
        'success': True,
        'data': {
            'folders': [f.to_dict() for f in folders]
        }
    }
    
    return jsonify(response_data), 200

@bp.route('/<string:id>/contents', methods=['GET'])
@authenticate_token
def get_folder_contents(id):
    """Get folder contents - optimized to use 4 queries total"""
    # Start performance monitoring
    start_request_timing()
    
    try:
        include_files = request.args.get('includeFiles', 'true') == 'true'
        
        # Query 1: Get folder with DataRoom (single join, no lazy loading)
        from sqlalchemy.orm import joinedload
        folder = Folder.query.options(
            joinedload(Folder.data_room)
        ).join(DataRoom).filter(
            Folder.id == id,
            DataRoom.user_id == g.user.id
        ).first()
        
        if not folder:
            # Query 2: Check if folder exists at all (for 403 vs 404) - only if needed
            folder_exists = Folder.query.filter_by(id=id).first()
            if folder_exists:
                raise create_error('You are not authorized to access this folder', 403)
            raise create_error('Folder not found', 404)
        
        # Query 3: Get children folders with counts using subqueries (single query, no N+1)
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
        
        # Single optimized query: Get children with counts in one go
        children_with_counts = db.session.query(
            Folder,
            func.coalesce(child_count_subq.c.child_count, 0).label('child_count'),
            func.coalesce(file_count_subq.c.file_count, 0).label('file_count')
        ).outerjoin(
            child_count_subq, Folder.id == child_count_subq.c.parent_folder_id
        ).outerjoin(
            file_count_subq, Folder.id == file_count_subq.c.folder_id
        ).filter(
            Folder.parent_folder_id == id
        ).order_by(Folder.name.asc()).all()
        
        # Query 4: Get files if needed (single query)
        files = []
        if include_files:
            files_data = File.query.filter_by(folder_id=id).order_by(File.name.asc()).all()
            # Respect fields parameter for payload optimization
            requested_fields = request.args.get('fields', '').split(',') if request.args.get('fields') else None
            
            for f in files_data:
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
        
        # Build response with field filtering
        requested_fields = request.args.get('fields', '').split(',') if request.args.get('fields') else None
        
        folder_dict = {}
        if not requested_fields or 'id' in requested_fields:
            folder_dict['id'] = str(folder.id)
        if not requested_fields or 'name' in requested_fields:
            folder_dict['name'] = folder.name
        if not requested_fields or 'parentId' in requested_fields:
            folder_dict['parentId'] = str(folder.parent_folder_id) if folder.parent_folder_id else None
        if not requested_fields or 'dataRoomId' in requested_fields:
            folder_dict['dataRoomId'] = str(folder.data_room_id)
        if not requested_fields or 'dataRoom' in requested_fields or not requested_fields:
            folder_dict['dataRoom'] = {
                'id': str(folder.data_room.id),
                'name': folder.data_room.name
            }
        if not requested_fields or 'createdAt' in requested_fields:
            folder_dict['createdAt'] = folder.created_at.isoformat()
        if not requested_fields or 'updatedAt' in requested_fields:
            folder_dict['updatedAt'] = folder.updated_at.isoformat()
        
        # Filter children fields
        filtered_children = []
        for child_folder, child_count, file_count in children_with_counts:
            child_dict = {}
            if not requested_fields or 'id' in requested_fields:
                child_dict['id'] = str(child_folder.id)
            if not requested_fields or 'name' in requested_fields:
                child_dict['name'] = child_folder.name
            if not requested_fields or 'parentId' in requested_fields:
                child_dict['parentId'] = str(child_folder.parent_folder_id) if child_folder.parent_folder_id else None
            if not requested_fields or 'dataRoomId' in requested_fields:
                child_dict['dataRoomId'] = str(child_folder.data_room_id)
            if not requested_fields or 'userId' in requested_fields:
                child_dict['userId'] = str(child_folder.user_id)
            if not requested_fields or 'createdAt' in requested_fields:
                child_dict['createdAt'] = child_folder.created_at.isoformat()
            if not requested_fields or 'updatedAt' in requested_fields:
                child_dict['updatedAt'] = child_folder.updated_at.isoformat()
            if not requested_fields or '_count' in requested_fields:
                child_dict['_count'] = {
                    'children': int(child_count),
                    'files': int(file_count)
                }
            filtered_children.append(child_dict)
        
        response_data = {
            'success': True,
            'data': {
                'folder': folder_dict,
                'children': filtered_children,
                'files': files
            }
        }
        
        return jsonify(response_data), 200
    finally:
        # End performance monitoring and record stats
        stats = end_request_timing()
        if stats:
            record_stats(stats)
            # Log current request stats
            print(f"[Performance] Folder contents endpoint - Total: {stats['total_time_ms']:.2f}ms, "
                  f"Queries: {stats['query_count']}, Query Time: {stats['total_query_time_ms']:.2f}ms")

@bp.route('/<string:id>/tree', methods=['GET'])
@authenticate_token
def get_folder_tree(id):
    """Get folder tree (breadcrumb)"""
    # Verify folder exists and user has access
    folder = Folder.query.join(DataRoom).filter(
        Folder.id == id,
        DataRoom.user_id == g.user.id
    ).first()
    
    if not folder:
        raise create_error('Folder not found', 404)
    
    # Build breadcrumb path
    def build_breadcrumb(folder_id):
        breadcrumb = []
        current = Folder.query.filter_by(id=folder_id).first()
        
        while current:
            breadcrumb.insert(0, {
                'id': str(current.id),
                'name': current.name,
                'parentId': str(current.parent_folder_id) if current.parent_folder_id else None
            })
            if current.parent_folder_id:
                current = Folder.query.filter_by(id=current.parent_folder_id).first()
            else:
                break
        
        return breadcrumb
    
    breadcrumb = build_breadcrumb(id)
    
    return jsonify({
        'success': True,
        'data': {
            'currentFolder': {
                'id': str(folder.id),
                'name': folder.name,
                'parentId': str(folder.parent_folder_id) if folder.parent_folder_id else None,
                'dataRoomId': str(folder.data_room_id),
                'dataRoom': {
                    'id': str(folder.data_room.id),
                    'name': folder.data_room.name
                }
            },
            'breadcrumb': breadcrumb
        }
    }), 200

@bp.route('', methods=['POST'])
@authenticate_token
def create_folder():
    """Create a new folder - optimized to ~100ms"""
    import time
    from sqlalchemy import exists
    
    start_request_timing()
    started = time.perf_counter()
    
    def step(label: str, step_start: float = None):
        """Log performance step and return current time"""
        t = step_start if step_start is not None else started
        elapsed = (time.perf_counter() - t) * 1000
        print(f"[folders.create] {label}: {elapsed:.1f}ms")
        return time.perf_counter()
    
    # Log timing from request arrival to handler entry
    request_arrival_time = getattr(g, 'request_start_time', started)
    auth_complete_time = getattr(g, 'auth_complete_time', started)
    handler_entry_time = time.perf_counter()
    
    request_to_handler = (handler_entry_time - request_arrival_time) * 1000
    auth_to_handler = (handler_entry_time - auth_complete_time) * 1000 if hasattr(g, 'auth_complete_time') else 0
    
    if getattr(g, 'log_request_timing', False):
        print(f"[handler.timing] Request arrival → Handler entry: {request_to_handler:.1f}ms")
        if auth_to_handler > 0:
            print(f"  Auth complete → Handler entry: {auth_to_handler:.1f}ms")
    
    step('handler start')
    
    try:
        # Time JSON body parsing (Flask parses lazily when request.json is first accessed)
        json_parse_start = time.perf_counter()
        request_json = request.json  # Trigger JSON parsing
        json_parse_time = (time.perf_counter() - json_parse_start) * 1000
        
        if getattr(g, 'log_request_timing', False):
            print(f"[body.timing] JSON parsing: {json_parse_time:.1f}ms")
        
        # Schema validation
        schema_start = time.perf_counter()
        schema = FolderCreationSchema()
        try:
            data = schema.load(request_json)
        except ValidationError as err:
            return jsonify({'errors': err.messages}), 400
        schema_start = step('schema validation', schema_start)
        
        name = data['name']
        parent_id = data.get('parentId')
        data_room_id = data['dataRoomId']
        
        # Batch all DB work in a single transaction
        # This reuses the same connection and avoids multiple round trips
        # Ownership check and insert happen atomically - FK and unique constraints handle validation
        db_work_start = time.perf_counter()
        
        try:
            # Verify ownership using EXISTS (faster than SELECT, uses index on data_rooms.user_id)
            # This check happens before insert to give a clear error if data room doesn't exist
            ownership_check_start = time.perf_counter()
            ownership_exists = db.session.query(
                exists().where(
                    DataRoom.id == data_room_id,
                    DataRoom.user_id == g.user.id
                )
            ).scalar()
            ownership_check_time = (time.perf_counter() - ownership_check_start) * 1000
            
            if getattr(g, 'log_request_timing', False):
                print(f"[query.timing] Ownership check (EXISTS): {ownership_check_time:.1f}ms")
            
            if not ownership_exists:
                raise create_error('Data room not found', 404)
            
            # Create folder - FK constraints will catch invalid data_room_id or parent_folder_id
            # Unique index idx_folder_unique will catch name conflicts automatically
            # The index supports fast lookups on (data_room_id, parent_folder_id, lower(name))
            insert_start = time.perf_counter()
            new_folder = Folder(
                name=name,
                parent_folder_id=parent_id,
                data_room_id=data_room_id,
                user_id=g.user.id
            )
            db.session.add(new_folder)
            db.session.commit()
            insert_time = (time.perf_counter() - insert_start) * 1000
            
            if getattr(g, 'log_request_timing', False):
                print(f"[query.timing] Folder insert: {insert_time:.1f}ms")
            
        except IntegrityError as e:
            # Unique index violation (409) or FK constraint violation (400)
            db.session.rollback()
            raise
        
        db_work_time = (time.perf_counter() - db_work_start) * 1000
        step('DB work (ownership + create)', db_work_start)
        
        # Return trimmed response (just id, name, parentId, dataRoomId)
        response = jsonify({
            'success': True,
            'data': {
                'id': new_folder.id,
                'name': new_folder.name,
                'parentId': new_folder.parent_folder_id,
                'dataRoomId': new_folder.data_room_id
            },
            'message': 'Folder created successfully'
        })
        step('handler total')
        return response, 201
    except IntegrityError as e:
        # Unique index violation (409) or FK constraint violation (400)
        # Error handler will format the message appropriately
        db.session.rollback()
        step('handler total (conflict/FK error)')
        raise
    except Exception as e:
        db.session.rollback()
        step('handler total (error)')
        raise
    finally:
        stats = end_request_timing()
        if stats:
            record_stats(stats)
            print(f"[Performance] Create folder - Total: {stats['total_time_ms']:.2f}ms, "
                  f"Queries: {stats['query_count']}, Query Time: {stats['total_query_time_ms']:.2f}ms")

@bp.route('/<string:id>/rename', methods=['PATCH'])
@authenticate_token
def rename_folder(id):
    """Rename a folder"""
    start_request_timing()
    
    try:
        schema = FolderRenameSchema()
        try:
            data = schema.load(request.json)
        except ValidationError as err:
            return jsonify({'errors': err.messages}), 400
        
        # Single query: get folder with data room validation
        folder = Folder.query.join(DataRoom).filter(
            Folder.id == id,
            DataRoom.user_id == g.user.id
        ).first()
        
        if not folder:
            raise create_error('Folder not found', 404)
        
        name = data['name']
        
        # Update name - unique constraint will catch conflicts automatically
        # No need for manual conflict check - database enforces uniqueness
        folder.name = name
        db.session.commit()
        
        # Return trimmed response (just id, name, parentId, dataRoomId)
        # No counts - keeps response lightweight and avoids extra queries
        return jsonify({
            'success': True,
            'data': {
                'id': folder.id,
                'name': folder.name,
                'parentId': folder.parent_folder_id,
                'dataRoomId': folder.data_room_id
            }
        }), 200
    except IntegrityError as e:
        # Unique constraint violation - database caught the conflict
        db.session.rollback()
        error_str = str(e.orig) if hasattr(e, 'orig') else str(e)
        if 'idx_folder_unique' in error_str:
            raise create_error('A folder with this name already exists in this location', 409)
        raise  # Re-raise other integrity errors
    except Exception as e:
        db.session.rollback()
        raise
    finally:
        stats = end_request_timing()
        if stats:
            record_stats(stats)
            print(f"[Performance] Rename folder - Total: {stats['total_time_ms']:.2f}ms, "
                  f"Queries: {stats['query_count']}, Query Time: {stats['total_query_time_ms']:.2f}ms")

@bp.route('/<string:id>/move', methods=['PATCH'])
@authenticate_token
def move_folder(id):
    """Move a folder"""
    schema = FolderMoveSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400
    
    try:
        folder = Folder.query.join(DataRoom).filter(
            Folder.id == id,
            DataRoom.user_id == g.user.id
        ).first()
        
        if not folder:
            raise create_error('Folder not found', 404)
        
        new_parent_id = data.get('newParentId')
        
        # Store old parent ID before changing it
        old_parent_id = folder.parent_folder_id
        
        # If newParentId is provided, verify new parent folder exists
        if new_parent_id:
            new_parent = Folder.query.filter_by(id=new_parent_id, data_room_id=folder.data_room_id).first()
            if not new_parent:
                raise create_error('New parent folder not found', 404)
        
        folder.parent_folder_id = new_parent_id
        db.session.commit()
        
        return jsonify(folder.to_dict(include_counts=True)), 200
    except Exception as e:
        db.session.rollback()
        raise

def delete_folder_recursive(folder_id):
    """Recursively delete a folder and all its contents (child folders and files)"""
    # Get all child folders
    child_folders = Folder.query.filter_by(parent_folder_id=folder_id).all()
    
    # Recursively delete each child folder
    for child_folder in child_folders:
        delete_folder_recursive(child_folder.id)
    
    # Get all files in this folder
    files = File.query.filter_by(folder_id=folder_id).all()
    
    # Delete all files (including physical files from Supabase storage)
    for file in files:
        # Delete physical file from Supabase storage
        if file.file_path:
            try:
                delete_supabase_file(file.file_path)
            except Exception as e:
                print(f'Error deleting file from storage: {e}')
        
        # Delete file record from database
        db.session.delete(file)
    
    # Delete the folder itself
    folder = Folder.query.filter_by(id=folder_id).first()
    if folder:
        db.session.delete(folder)

@bp.route('/<string:id>', methods=['DELETE'])
@authenticate_token
def delete_folder(id):
    """Delete a folder and all its contents recursively"""
    start_request_timing()
    
    try:
        folder = Folder.query.join(DataRoom).filter(
            Folder.id == id,
            DataRoom.user_id == g.user.id
        ).first()
        
        if not folder:
            raise create_error('Folder not found', 404)
        
        data_room_id = folder.data_room_id
        parent_id = folder.parent_folder_id
        
        # Recursively delete folder and all its contents
        delete_folder_recursive(id)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Folder deleted successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        raise
    finally:
        stats = end_request_timing()
        if stats:
            record_stats(stats)
            print(f"[Performance] Delete folder - Total: {stats['total_time_ms']:.2f}ms, "
                  f"Queries: {stats['query_count']}, Query Time: {stats['total_query_time_ms']:.2f}ms")

