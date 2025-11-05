"""
Error handling middleware
"""
from flask import jsonify, request, has_request_context
from werkzeug.exceptions import HTTPException
import traceback
from config import Config
from sqlalchemy.exc import OperationalError, DatabaseError, IntegrityError

class AppError(Exception):
    """Custom application error"""
    def __init__(self, message, status_code=500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def create_error(message, status_code=500):
    """Create an application error"""
    return AppError(message, status_code)


def error_handler(error):
    """Global error handler"""
    status_code = 500
    message = str(error)
    
    # Handle HTTP exceptions
    if isinstance(error, HTTPException):
        status_code = error.code
        message = error.description
    
    # Handle custom errors with status_code attribute
    if hasattr(error, 'status_code'):
        status_code = error.status_code
        if hasattr(error, 'message'):
            message = error.message
    
    # Handle database integrity errors (unique constraint violations)
    if isinstance(error, IntegrityError):
        error_str = str(error.orig) if hasattr(error, 'orig') else str(error)
        
        # Check for foreign key violations first (they come before unique constraint violations in error message)
        if 'foreign key' in error_str.lower() or 'violates foreign key constraint' in error_str.lower():
            status_code = 400  # Bad Request
            if 'parent_folder_id' in error_str.lower() or 'folders_parent_folder_id' in error_str.lower():
                message = 'Parent folder not found or does not belong to this data room.'
            elif 'data_room_id' in error_str.lower() or 'folders_data_room_id' in error_str.lower():
                message = 'Data room not found.'
            elif 'folder_id' in error_str.lower() or 'files_folder_id' in error_str.lower():
                message = 'Folder not found or does not belong to this data room.'
            else:
                message = 'Invalid reference. Please check your input and try again.'
        # Check for unique constraint violations
        elif 'unique' in error_str.lower() or 'duplicate' in error_str.lower():
            status_code = 409  # Conflict
            
            # Parse which constraint was violated for better error messages
            if 'uq_data_room_user_name' in error_str or 'idx_data_room_user_name' in error_str:
                message = 'A data room with this name already exists. Please choose a different name.'
            elif 'uq_folder_parent_name' in error_str or 'idx_folder_unique' in error_str:
                message = 'A folder with this name already exists in this location. Please choose a different name.'
            elif 'uq_file_folder_name' in error_str or 'idx_file_unique' in error_str:
                message = 'A file with this name already exists in this location. Please choose a different name.'
            elif 'users_email_key' in error_str or 'email' in error_str.lower():
                message = 'An account with this email already exists.'
            elif 'google_drive_tokens_user_id_key' in error_str:
                message = 'Google Drive token already exists for this user.'
            else:
                message = 'A record with this name already exists. Please choose a different name.'
        else:
            # Other integrity errors (foreign key violations, etc.)
            status_code = 400
            message = 'Invalid data provided. Please check your input and try again.'
        
        # Log the actual error for debugging
        if Config.NODE_ENV == 'development':
            print(f'IntegrityError: {error_str}')
            print(f'Traceback: {traceback.format_exc()}')
    
    # Handle other database errors
    elif isinstance(error, (OperationalError, DatabaseError)):
        status_code = 503  # Service Unavailable
        message = 'Database connection error. Please try again later.'
        # Log the actual error for debugging
        if Config.NODE_ENV == 'development':
            print(f'Database error: {str(error)}')
            print(f'Traceback: {traceback.format_exc()}')
    
    # Log error for debugging
    if has_request_context():
        print(f'Error: {message}')
        print(f'URL: {request.url}')
        print(f'Method: {request.method}')
    else:
        print(f'Error: {message}')
    
    if Config.NODE_ENV == 'development':
        print(f'Traceback: {traceback.format_exc()}')
    
    # Handle specific error types
    if isinstance(error, ValueError):
        status_code = 400
    elif isinstance(error, PermissionError):
        status_code = 403
    elif isinstance(error, FileNotFoundError):
        status_code = 404
    
    # Don't leak error details in production
    if Config.NODE_ENV == 'production' and status_code == 500:
        message = 'Internal Server Error'
    
    response = {
        'success': False,
        'error': message,
        'message': message,  # Some frontend code might check 'message' instead of 'error'
    }
    
    if Config.NODE_ENV == 'development':
        response['stack'] = traceback.format_exc()
    
    return jsonify(response), status_code

