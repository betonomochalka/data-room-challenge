"""
Google Drive routes
"""
from flask import Blueprint, request, jsonify, redirect, g
from database import db
from models import File
from middleware.auth import authenticate_token
from middleware.error_handler import create_error
from services.google_drive_service import google_drive_service
from utils.supabase_storage import upload_file as upload_to_supabase
from utils.file_validation import validate_file_type
from utils.conflict_checker import check_name_conflicts
from config import Config

bp = Blueprint('google_drive', __name__)

@bp.route('/auth', methods=['GET'])
@authenticate_token
def get_auth_url():
    """Get Google OAuth URL"""
    user_id = g.user.id
    
    auth_url = google_drive_service.get_auth_url(str(user_id))
    
    return jsonify({
        'success': True,
        'data': {'authUrl': auth_url}
    }), 200

@bp.route('/callback', methods=['GET'])
def handle_callback():
    """Handle OAuth callback from Google"""
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')
    error_description = request.args.get('error_description')
    scope = request.args.get('scope')  # Get granted scopes from callback
    
    frontend_url = Config.FRONTEND_URL
    
    print(f'[Google Drive OAuth] Callback received: code={bool(code)}, state={bool(state)}, error={error}, scope={scope}')
    
    if error:
        print(f'[Google Drive OAuth] Google returned error: {error}, {error_description}')
        return redirect(
            f'{frontend_url}?google_drive=error&reason={error}&details={error_description or ""}'
        )
    
    if not code:
        return redirect(f'{frontend_url}?google_drive=error&reason=no_code')
    
    if not state:
        return redirect(f'{frontend_url}?google_drive=error&reason=no_state')
    
    user_id = state
    
    try:
        # If scope is provided in callback and contains extra scopes (like 'openid'),
        # use manual token exchange to avoid library's strict scope checking
        if scope:
            # Check if scope contains extra scopes that Google added
            scope_list = scope.split()
            expected_scopes = [
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile'
            ]
            has_extra_scopes = any(s not in expected_scopes for s in scope_list)
            
            if has_extra_scopes:
                print(f'[Google Drive OAuth] Detected extra scopes in callback, using manual exchange')
                google_drive_service.handle_oauth_callback(code, user_id, granted_scopes=scope)
            else:
                google_drive_service.handle_oauth_callback(code, user_id)
        else:
            # No scope in callback, try normal flow
            google_drive_service.handle_oauth_callback(code, user_id)
        
        return redirect(f'{frontend_url}?google_drive=connected')
    except Exception as e:
        print(f'[Google Drive OAuth] Callback route error: {e}')
        error_reason = 'redirect_uri_mismatch' if 'redirect_uri_mismatch' in str(e) else 'callback_failed'
        return redirect(f'{frontend_url}?google_drive=error&reason={error_reason}')

@bp.route('/status', methods=['GET'])
@authenticate_token
def get_status():
    """Check if user has connected Google Drive"""
    user_id = g.user.id
    
    is_connected = google_drive_service.is_connected(str(user_id))
    
    user_info = None
    if is_connected:
        try:
            user_info = google_drive_service.get_user_info(str(user_id))
        except Exception as e:
            print(f'Error fetching Google user info: {e}')
    
    return jsonify({
        'success': True,
        'data': {
            'connected': is_connected,
            'userInfo': user_info
        }
    }), 200

@bp.route('/disconnect', methods=['DELETE'])
@authenticate_token
def disconnect():
    """Disconnect Google Drive"""
    user_id = g.user.id
    
    google_drive_service.disconnect(str(user_id))
    
    return jsonify({
        'success': True,
        'message': 'Google Drive disconnected successfully'
    }), 200

@bp.route('/files', methods=['GET'])
@authenticate_token
def list_files():
    """List files from user's Google Drive"""
    user_id = g.user.id
    page_size = request.args.get('pageSize', 50, type=int)
    page_token = request.args.get('pageToken')
    query = request.args.get('query')
    
    try:
        result = google_drive_service.list_files(
            str(user_id),
            page_size,
            page_token,
            query
        )
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
    except Exception as e:
        print(f'Error listing Google Drive files: {e}')
        if 'authenticate' in str(e).lower():
            raise create_error(str(e), 401)
        raise create_error('Failed to fetch Google Drive files', 500)

@bp.route('/import', methods=['POST'])
@authenticate_token
def import_file():
    """Import a file from Google Drive to the data room"""
    user_id = g.user.id
    data = request.json
    file_id = data.get('fileId')
    data_room_id = data.get('dataRoomId')
    folder_id = data.get('folderId')
    file_name = data.get('fileName')
    
    if not file_id:
        raise create_error('fileId is required', 400)
    
    if not data_room_id:
        raise create_error('dataRoomId is required', 400)
    
    try:
        # Download file from Google Drive
        download_result = google_drive_service.download_file(str(user_id), file_id)
        
        original_file_name = download_result['fileName']
        final_name = file_name or original_file_name
        mime_type = download_result['mimeType']
        buffer = download_result['buffer']
        size = download_result['size']
        
        # Validate file type
        validation = validate_file_type(mime_type, final_name)
        if not validation['valid']:
            raise create_error(validation.get('error', 'Invalid file type'), 400)
        
        # Check for name conflicts
        conflicts = check_name_conflicts(final_name, data_room_id, folder_id)
        if conflicts['folderConflict']:
            raise create_error('A folder with this name already exists in this location', 409)
        if conflicts['fileConflict']:
            raise create_error('A file with this name already exists in this location', 409)
        
        # Upload to Supabase storage
        file_path = upload_to_supabase(buffer, final_name, f'uploads/{user_id}', mime_type)
        
        # Create file record
        new_file = File(
            name=final_name,
            data_room_id=data_room_id,
            folder_id=folder_id,
            user_id=user_id,
            file_size=size,
            mime_type=mime_type,
            file_path=file_path
        )
        db.session.add(new_file)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': new_file.to_dict()
        }), 201
    except Exception as e:
        print(f'Error importing file from Google Drive: {e}')
        if 'authenticate' in str(e).lower():
            raise create_error(str(e), 401)
        raise create_error('Failed to import file from Google Drive', 500)

@bp.route('/import-multiple', methods=['POST'])
@authenticate_token
def import_multiple_files():
    """Import multiple files from Google Drive to the data room"""
    user_id = g.user.id
    data = request.json
    file_ids = data.get('fileIds')
    data_room_id = data.get('dataRoomId')
    folder_id = data.get('folderId')
    
    if not file_ids or not isinstance(file_ids, list) or len(file_ids) == 0:
        raise create_error('fileIds array is required', 400)
    
    if not data_room_id:
        raise create_error('dataRoomId is required', 400)
    
    results = {
        'success': [],
        'failed': []
    }
    
    # Import files sequentially
    for file_id in file_ids:
        try:
            # Download file from Google Drive
            download_result = google_drive_service.download_file(str(user_id), file_id)
            
            file_name = download_result['fileName']
            mime_type = download_result['mimeType']
            buffer = download_result['buffer']
            size = download_result['size']
            
            # Validate file type
            validation = validate_file_type(mime_type, file_name)
            if not validation['valid']:
                results['failed'].append({
                    'fileId': file_id,
                    'fileName': file_name,
                    'reason': validation.get('error', 'Invalid file type')
                })
                continue
            
            # Check for conflicts
            conflicts = check_name_conflicts(file_name, data_room_id, folder_id)
            if conflicts['folderConflict']:
                results['failed'].append({
                    'fileId': file_id,
                    'fileName': file_name,
                    'reason': 'Folder with same name exists'
                })
                continue
            if conflicts['fileConflict']:
                results['failed'].append({
                    'fileId': file_id,
                    'fileName': file_name,
                    'reason': 'File with same name exists'
                })
                continue
            
            # Upload to Supabase storage
            file_path = upload_to_supabase(buffer, file_name, f'uploads/{user_id}', mime_type)
            
            # Create file record
            new_file = File(
                name=file_name,
                data_room_id=data_room_id,
                folder_id=folder_id,
                user_id=user_id,
                file_size=size,
                mime_type=mime_type,
                file_path=file_path
            )
            db.session.add(new_file)
            db.session.commit()
            
            results['success'].append(new_file.to_dict())
        except Exception as e:
            print(f'Error importing file {file_id}: {e}')
            results['failed'].append({
                'fileId': file_id,
                'reason': str(e)
            })
    
    return jsonify({
        'success': True,
        'data': results
    }), 200

