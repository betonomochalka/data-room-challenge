"""
Supabase storage utilities
"""
from supabase import create_client, Client
from config import Config

# Create Supabase client with service role key
supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_ROLE_KEY)

def create_signed_upload_url(file_name: str, folder: str = 'uploads', mime_type: str = None, expires_in: int = 3600) -> dict:
    """Create a signed URL for direct upload to Supabase storage
    
    Returns:
        dict with 'upload_url', 'file_path', and 'expires_at'
    """
    import os
    from datetime import datetime, timedelta
    
    # Generate unique file path
    file_ext = os.path.splitext(file_name)[1]
    timestamp = int(datetime.now().timestamp() * 1000)
    random_str = os.urandom(8).hex()
    file_path = f'{folder}/{timestamp}-{random_str}{file_ext}'
    
    # Determine content type
    if not mime_type:
        ext = file_ext.lower().lstrip('.')
        mime_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'pdf': 'application/pdf',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
        mime_type = mime_map.get(ext, 'application/octet-stream')
    
    bucket_name = 'data-room-files'
    
    try:
        # Create signed upload URL (Supabase uses create_signed_url for both download and upload)
        # For uploads, the client can PUT directly to this URL
        response = supabase.storage.from_(bucket_name).create_signed_url(file_path, expires_in)
        
        # Handle different response formats
        if isinstance(response, dict):
            if response.get('error'):
                raise Exception(f'Failed to create signed upload URL: {response["error"]}')
            signed_url = response.get('signedURL') or response.get('signed_url')
        elif hasattr(response, 'signedURL'):
            signed_url = response.signedURL
        elif hasattr(response, 'signed_url'):
            signed_url = response.signed_url
        else:
            signed_url = str(response)
        
        expires_at = datetime.now() + timedelta(seconds=expires_in)
        
        return {
            'upload_url': signed_url,
            'file_path': file_path,
            'expires_at': expires_at.isoformat(),
            'mime_type': mime_type
        }
    except Exception as e:
        if hasattr(e, 'message'):
            raise Exception(f'Failed to create signed upload URL: {e.message}')
        raise Exception(f'Failed to create signed upload URL: {str(e)}')

def upload_file(file_content: bytes, file_name: str, folder: str = 'uploads', mime_type: str = None) -> str:
    """Upload file to Supabase storage"""
    # Generate unique file path
    file_ext = os.path.splitext(file_name)[1]
    timestamp = int(datetime.now().timestamp() * 1000)
    random_str = os.urandom(8).hex()
    file_path = f'{folder}/{timestamp}-{random_str}{file_ext}'
    
    # Determine content type
    if not mime_type:
        ext = file_ext.lower().lstrip('.')
        mime_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'pdf': 'application/pdf',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
        mime_type = mime_map.get(ext, 'application/octet-stream')
    
    # Upload to Supabase
    try:
        response = supabase.storage.from_('data-room-files').upload(
            file_path,
            file_content,
            file_options={'content-type': mime_type}
        )
        
        # Check if there's an error
        if hasattr(response, 'error') and response.error:
            raise Exception(f'Failed to upload file: {response.error}')
        
        return file_path
    except Exception as e:
        # Handle both dict and object responses
        if isinstance(e, Exception):
            raise
        if hasattr(e, 'message'):
            raise Exception(f'Failed to upload file: {e.message}')
        raise Exception(f'Failed to upload file: {str(e)}')

def get_signed_url(file_path: str) -> str:
    """Get signed URL for file viewing"""
    # Extract path if it's a full URL
    bucket_name = 'data-room-files'
    if bucket_name in file_path:
        path = file_path.split(f'{bucket_name}/', 1)[-1]
    else:
        path = file_path
    
    # Create signed URL (60 seconds expiry)
    try:
        response = supabase.storage.from_(bucket_name).create_signed_url(path, 60)
        
        # Handle different response formats
        if isinstance(response, dict):
            if response.get('error'):
                raise Exception(f'Failed to create signed URL: {response["error"]}')
            return response.get('signedURL') or response.get('signed_url')
        elif hasattr(response, 'signedURL'):
            return response.signedURL
        elif hasattr(response, 'signed_url'):
            return response.signed_url
        else:
            return str(response)
    except Exception as e:
        if hasattr(e, 'message'):
            raise Exception(f'Failed to create signed URL: {e.message}')
        raise Exception(f'Failed to create signed URL: {str(e)}')

def delete_file(file_path: str) -> None:
    """Delete file from Supabase storage"""
    # Extract path if it's a full URL
    bucket_name = 'data-room-files'
    if bucket_name in file_path:
        path = file_path.split(f'{bucket_name}/', 1)[-1]
    else:
        path = file_path
    
    try:
        response = supabase.storage.from_(bucket_name).remove([path])
        
        # Check if there's an error
        if isinstance(response, dict) and response.get('error'):
            raise Exception(f'Failed to delete file: {response["error"]}')
        if hasattr(response, 'error') and response.error:
            raise Exception(f'Failed to delete file: {response.error}')
    except Exception as e:
        if hasattr(e, 'message'):
            raise Exception(f'Failed to delete file: {e.message}')
        raise Exception(f'Failed to delete file: {str(e)}')

def get_file_url(file_path: str) -> str:
    """Get public URL for file"""
    bucket_name = 'data-room-files'
    if bucket_name in file_path:
        path = file_path.split(f'{bucket_name}/', 1)[-1]
    else:
        path = file_path
    
    response = supabase.storage.from_(bucket_name).get_public_url(path)
    
    if isinstance(response, dict):
        return response.get('publicUrl') or response.get('public_url')
    elif hasattr(response, 'publicUrl'):
        return response.publicUrl
    elif hasattr(response, 'public_url'):
        return response.public_url
    else:
        return str(response)

