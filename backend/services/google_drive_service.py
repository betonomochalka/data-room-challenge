"""
Google Drive service
"""
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.auth.transport.requests import Request
from database import db
from models import GoogleDriveToken
from config import Config
from utils.file_validation import ALLOWED_MIME_TYPES
import io
import requests
from datetime import datetime, timedelta

SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
]

class GoogleDriveService:
    """Service for Google Drive integration"""
    
    def __init__(self):
        redirect_uri = Config.get_redirect_uri()
        
        if not Config.GOOGLE_CLIENT_ID or not Config.GOOGLE_CLIENT_SECRET:
            raise ValueError(
                'Google OAuth credentials are not configured. '
                'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
            )
        
        if not redirect_uri:
            raise ValueError(
                'Google OAuth redirect URI is not configured. '
                'Please set GOOGLE_REDIRECT_URI environment variable.'
            )
        
        self.redirect_uri = redirect_uri
        self.client_id = Config.GOOGLE_CLIENT_ID
        self.client_secret = Config.GOOGLE_CLIENT_SECRET
    
    def get_auth_url(self, user_id: str) -> str:
        """Generate OAuth2 authorization URL"""
        flow = Flow.from_client_config(
            {
                'web': {
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                    'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                    'token_uri': 'https://oauth2.googleapis.com/token',
                    'redirect_uris': [self.redirect_uri]
                }
            },
            scopes=SCOPES
        )
        flow.redirect_uri = self.redirect_uri
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            prompt='consent',
            state=user_id
        )
        
        print(f'[Google OAuth] Generated auth URL: {auth_url}')
        return auth_url
    
    def handle_oauth_callback(self, code: str, user_id: str, granted_scopes: str = None) -> None:
        """Exchange authorization code for tokens and store them"""
        try:
            # If we have granted scopes from callback URL, use them directly
            # Otherwise, try using the library first
            if granted_scopes:
                # Manual token exchange when we know Google added extra scopes
                print(f'[Google OAuth] Using manual token exchange with scopes: {granted_scopes}')
                token_response = requests.post(
                    'https://oauth2.googleapis.com/token',
                    data={
                        'code': code,
                        'client_id': self.client_id,
                        'client_secret': self.client_secret,
                        'redirect_uri': self.redirect_uri,
                        'grant_type': 'authorization_code'
                    },
                    headers={
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                )
                
                if not token_response.ok:
                    error_text = token_response.text
                    print(f'[Google OAuth] Token exchange failed: {error_text}')
                    raise Exception(f'Failed to exchange code: {error_text}')
                
                token_data = token_response.json()
                access_token = token_data.get('access_token')
                refresh_token = token_data.get('refresh_token')
                expires_in = token_data.get('expires_in', 3600)
                
                if not access_token:
                    raise Exception('Failed to obtain access token')
                
                # Verify we got the required scopes
                granted_scopes_set = set(token_data.get('scope', granted_scopes).split())
                required_scopes = set(SCOPES)
                if not required_scopes.issubset(granted_scopes_set):
                    missing_scopes = required_scopes - granted_scopes_set
                    raise Exception(f'Missing required scopes: {missing_scopes}')
                
                # Create credentials object manually
                credentials = Credentials(
                    token=access_token,
                    refresh_token=refresh_token,
                    token_uri='https://oauth2.googleapis.com/token',
                    client_id=self.client_id,
                    client_secret=self.client_secret
                )
                credentials.expiry = datetime.utcnow() + timedelta(seconds=expires_in)
                
                expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                
                # Store or update tokens
                token_record = GoogleDriveToken.query.filter_by(user_id=user_id).first()
                if token_record:
                    token_record.access_token = credentials.token
                    token_record.refresh_token = credentials.refresh_token
                    token_record.expires_at = expires_at
                else:
                    token_record = GoogleDriveToken(
                        user_id=user_id,
                        access_token=credentials.token,
                        refresh_token=credentials.refresh_token,
                        expires_at=expires_at
                    )
                    db.session.add(token_record)
                
                db.session.commit()
                return
            
            # Try using the library first (normal flow)
            flow = Flow.from_client_config(
                {
                    'web': {
                        'client_id': self.client_id,
                        'client_secret': self.client_secret,
                        'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                        'token_uri': 'https://oauth2.googleapis.com/token',
                        'redirect_uris': [self.redirect_uri]
                    }
                },
                scopes=SCOPES
            )
            flow.redirect_uri = self.redirect_uri
            
            # Fetch token - Google may add standard scopes (openid, email, profile) which is fine
            try:
                flow.fetch_token(code=code)
            except Exception as fetch_error:
                # If error is about scope mismatch, we can't retry because code is already used
                # So we need to fail here and ask user to try again
                if 'scope' in str(fetch_error).lower() and 'changed' in str(fetch_error).lower():
                    print(f'[Google OAuth] Scope mismatch error: {fetch_error}')
                    raise Exception(
                        'OAuth scope mismatch detected. Please try connecting again. '
                        'The authorization code can only be used once.'
                    )
                else:
                    raise
            
            credentials = flow.credentials
            
            # Verify we got the required scopes (ignore standard Google scopes)
            granted_scopes_set = set(credentials.scopes) if credentials.scopes else set()
            required_scopes = set(SCOPES)
            # Check if all required scopes are present (ignore standard scopes like openid, email, profile)
            if not required_scopes.issubset(granted_scopes_set):
                missing_scopes = required_scopes - granted_scopes_set
                raise Exception(f'Missing required scopes: {missing_scopes}')
            
            if not credentials.token:
                raise Exception('Failed to obtain access token')
            
            expires_at = credentials.expiry if credentials.expiry else datetime.utcnow() + timedelta(hours=1)
            
            # Store or update tokens (user_id is already a string)
            token_record = GoogleDriveToken.query.filter_by(user_id=user_id).first()
            if token_record:
                token_record.access_token = credentials.token
                token_record.refresh_token = credentials.refresh_token
                token_record.expires_at = expires_at
            else:
                token_record = GoogleDriveToken(
                    user_id=user_id,
                    access_token=credentials.token,
                    refresh_token=credentials.refresh_token,
                    expires_at=expires_at
                )
                db.session.add(token_record)
            
            db.session.commit()
        except Exception as e:
            print(f'[Google OAuth] Callback error: {e}')
            if 'redirect_uri_mismatch' in str(e) or '400' in str(e):
                raise Exception(
                    f'Redirect URI mismatch. Expected: {self.redirect_uri}. '
                    f'Please ensure this exact URL is registered in Google Cloud Console authorized redirect URIs.'
                )
            raise
    
    def get_authenticated_client(self, user_id: str) -> Credentials:
        """Get authenticated OAuth2 client for a user (refreshes token if needed)"""
        token_data = GoogleDriveToken.query.filter_by(user_id=user_id).first()
        
        if not token_data:
            raise Exception('Google Drive not connected. Please authenticate first.')
        
        credentials = Credentials(
            token=token_data.access_token,
            refresh_token=token_data.refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=self.client_id,
            client_secret=self.client_secret
        )
        
        # Check if token is expired or about to expire (within 5 minutes)
        now = datetime.utcnow()
        expiry_threshold = now + timedelta(minutes=5)
        
        if token_data.expires_at < expiry_threshold:
            # Refresh the token
            try:
                credentials.refresh(Request())
                
                if credentials.token:
                    token_data.access_token = credentials.token
                    if credentials.refresh_token:
                        token_data.refresh_token = credentials.refresh_token
                    token_data.expires_at = credentials.expiry if credentials.expiry else now + timedelta(hours=1)
                    db.session.commit()
            except Exception as e:
                print(f'Error refreshing token: {e}')
                raise Exception('Failed to refresh Google Drive token. Please re-authenticate.')
        
        return credentials
    
    def list_files(self, user_id: str, page_size: int = 50, page_token: str = None, query: str = None) -> dict:
        """List files from Google Drive"""
        credentials = self.get_authenticated_client(user_id)
        service = build('drive', 'v3', credentials=credentials)
        
        # Build query - only show allowed file types
        mime_type_queries = [f"mimeType='{mime}'" for mime in ALLOWED_MIME_TYPES]
        file_query = f"trashed=false and ({' or '.join(mime_type_queries)})"
        
        # Add user's custom query if provided
        if query:
            file_query = f"{file_query} and (name contains '{query}')"
        
        request_params = {
            'pageSize': page_size,
            'q': file_query,
            'fields': 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)',
            'orderBy': 'modifiedTime desc'
        }
        
        if page_token:
            request_params['pageToken'] = page_token
        
        response = service.files().list(**request_params).execute()
        
        return {
            'files': [
                {
                    'id': file.get('id'),
                    'name': file.get('name'),
                    'mimeType': file.get('mimeType'),
                    'size': file.get('size'),
                    'modifiedTime': file.get('modifiedTime'),
                    'webViewLink': file.get('webViewLink'),
                    'iconLink': file.get('iconLink')
                }
                for file in response.get('files', [])
            ],
            'nextPageToken': response.get('nextPageToken')
        }
    
    def download_file(self, user_id: str, file_id: str) -> dict:
        """Download a file from Google Drive"""
        credentials = self.get_authenticated_client(user_id)
        service = build('drive', 'v3', credentials=credentials)
        
        # Get file metadata
        metadata = service.files().get(fileId=file_id, fields='id, name, mimeType, size').execute()
        
        original_mime_type = metadata.get('mimeType')
        file_name = metadata.get('name')
        final_mime_type = original_mime_type
        
        # Check if it's a Google Workspace file that needs to be exported
        if original_mime_type == 'application/vnd.google-apps.document':
            # Export Google Docs as PDF
            request = service.files().export_media(fileId=file_id, mimeType='application/pdf')
            final_mime_type = 'application/pdf'
            if not file_name.lower().endswith('.pdf'):
                file_name = f'{file_name}.pdf'
        elif original_mime_type == 'application/vnd.google-apps.spreadsheet':
            # Export Google Sheets as XLSX
            request = service.files().export_media(
                fileId=file_id,
                mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            final_mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            if not file_name.lower().endswith('.xlsx'):
                file_name = f'{file_name}.xlsx'
        else:
            # Download regular files
            request = service.files().get_media(fileId=file_id)
        
        # Download file content
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        buffer = fh.getvalue()
        
        return {
            'fileName': file_name,
            'mimeType': final_mime_type,
            'buffer': buffer,
            'size': len(buffer)
        }
    
    def is_connected(self, user_id: str) -> bool:
        """Check if user has connected Google Drive"""
        token_data = GoogleDriveToken.query.filter_by(user_id=user_id).first()
        return token_data is not None
    
    def disconnect(self, user_id: str) -> None:
        """Disconnect Google Drive (remove tokens)"""
        token_data = GoogleDriveToken.query.filter_by(user_id=user_id).first()
        if token_data:
            db.session.delete(token_data)
            db.session.commit()
    
    def get_user_info(self, user_id: str) -> dict:
        """Get user info from Google"""
        credentials = self.get_authenticated_client(user_id)
        service = build('oauth2', 'v2', credentials=credentials)
        
        user_info = service.userinfo().get().execute()
        
        return {
            'email': user_info.get('email'),
            'name': user_info.get('name'),
            'picture': user_info.get('picture')
        }

# Create singleton instance
google_drive_service = GoogleDriveService()

