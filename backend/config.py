"""
Configuration management
"""
import os
from dotenv import load_dotenv

load_dotenv()

def _clean_database_url(url):
    """Remove pgbouncer and other unsupported parameters from database URL"""
    if not url:
        return url
    # Remove pgbouncer parameter if present (can be ?pgbouncer=true or &pgbouncer=true)
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    
    try:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        
        # Remove pgbouncer parameter
        query_params.pop('pgbouncer', None)
        
        # Rebuild URL without pgbouncer parameter
        new_query = urlencode(query_params, doseq=True)
        new_parsed = parsed._replace(query=new_query)
        return urlunparse(new_parsed)
    except Exception:
        # Fallback: simple string replacement if URL parsing fails
        url = url.replace('?pgbouncer=true', '')
        url = url.replace('&pgbouncer=true', '')
        url = url.replace('pgbouncer=true', '')
        return url

class Config:
    """Application configuration"""
    
    # Database
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    # Clean DATABASE_URL - remove pgbouncer parameter as psycopg2 doesn't support it
    SQLALCHEMY_DATABASE_URI = _clean_database_url(DATABASE_URL)
    
    # Detect port from URI to determine pool settings
    try:
        from urllib.parse import urlparse
        parsed = urlparse(SQLALCHEMY_DATABASE_URI or '')
        _port = parsed.port or 5432
        _is_transaction_mode = _port == 6543
    except Exception:
        _port = 5432
        _is_transaction_mode = False
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Connection pool settings for Supabase
    # Session mode (port 5432) has strict limits - use smaller pool
    # Transaction mode (port 6543) supports more concurrent connections
    if _is_transaction_mode:
        # Transaction mode - can handle more connections
        SQLALCHEMY_POOL_SIZE = 5
        SQLALCHEMY_MAX_OVERFLOW = 5
        print(f'Using Transaction mode pool settings (port {_port})')
    else:
        # Session mode - conservative settings (Supabase free tier allows ~4 concurrent connections)
        SQLALCHEMY_POOL_SIZE = 2              # Small pool for Session mode
        SQLALCHEMY_MAX_OVERFLOW = 2           # Small overflow
        print(f'Using Session mode pool settings (port {_port})')
    
    SQLALCHEMY_POOL_TIMEOUT = 10              # Reduced timeout for faster failure
    SQLALCHEMY_POOL_RECYCLE = 1800            # Recycle connections after 30 minutes
    SQLALCHEMY_POOL_PRE_PING = True           # Verify connections before using them
    SQLALCHEMY_ENGINE_OPTIONS = {
        'connect_args': {
            'connect_timeout': 5,             # Shorter timeout (5 seconds)
            'options': '-c statement_timeout=20000'  # 20 second query timeout
        },
        'pool_reset_on_return': 'commit',      # Reset connection state on return
        'pool_pre_ping': True,                # Verify connections before using
        'pool_recycle': 1800,                  # Recycle connections after 30 minutes
        'echo': False                          # Don't log SQL queries (set to True for debugging)
    }
    
    # Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
    
    # Application
    PORT = os.getenv('PORT', '3001')
    NODE_ENV = os.getenv('NODE_ENV', 'development')
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000')
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    
    # Google Drive
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
    GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI')
    
    # File upload
    MAX_FILE_SIZE = 4.5 * 1024 * 1024  # 4.5MB
    
    # Cache (Redis) - Optional
    REDIS_URL = os.getenv('REDIS_URL')  # e.g., redis://localhost:6379/0
    CACHE_TTL = int(os.getenv('CACHE_TTL', '300'))  # Default 5 minutes
    CACHE_ENABLED = os.getenv('CACHE_ENABLED', 'true').lower() == 'true'
    
    # Validate required environment variables
    required_env_vars = [
        'DATABASE_URL',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_ANON_KEY',
        'ALLOWED_ORIGINS',
    ]
    
    @classmethod
    def validate(cls):
        """Validate that all required environment variables are set"""
        missing = [var for var in cls.required_env_vars if not os.getenv(var)]
        if missing:
            raise ValueError(f'Missing required environment variables: {", ".join(missing)}')
    
    @classmethod
    def get_redirect_uri(cls):
        """Get Google OAuth redirect URI"""
        if cls.GOOGLE_REDIRECT_URI:
            return cls.GOOGLE_REDIRECT_URI.strip().strip('"').strip("'")
        return None

# Validate configuration on import
Config.validate()

