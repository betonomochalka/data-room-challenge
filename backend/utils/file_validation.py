"""
File validation utilities
"""
ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  # .xlsx
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # .docx
    'application/vnd.google-apps.document',  # Google Docs (exported as PDF)
    'application/vnd.google-apps.spreadsheet',  # Google Sheets (exported as XLSX)
]

ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'docx']

def is_valid_file_type(mime_type: str, file_name: str) -> bool:
    """Check if file type is allowed"""
    file_extension = file_name.split('.')[-1].lower() if '.' in file_name else None
    return (
        mime_type in ALLOWED_MIME_TYPES or
        (file_extension and file_extension in ALLOWED_EXTENSIONS)
    )

def get_file_extension(file_name: str) -> str:
    """Get file extension from filename"""
    return file_name.split('.')[-1].lower() if '.' in file_name else None

def validate_file_type(mime_type: str, file_name: str) -> dict:
    """Validate file type and return error message if invalid"""
    if not is_valid_file_type(mime_type, file_name):
        return {
            'valid': False,
            'error': 'Invalid file type. Only JPG, PNG, PDF, XLSX, and DOCX files are allowed.'
        }
    return {'valid': True}

