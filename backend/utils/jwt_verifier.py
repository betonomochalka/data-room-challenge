"""
JWKS-based JWT verification for Supabase tokens
Supabase access tokens use HS256 with JWT secret, not RS256 with JWKS
JWKS is only used for refresh tokens in some cases
"""
import jwt
import requests
import time
from typing import Optional, Dict
from threading import Lock
from config import Config
from middleware.error_handler import create_error

def verify_supabase_jwt(token: str) -> Dict:
    """
    Verify Supabase JWT token locally using JWT secret (HS256)
    Supabase access tokens use HS256 with the JWT secret, not RS256 with JWKS
    Raises ValueError for signature verification failures (so caller can fall back to remote)
    Raises AppError for other errors (expired, invalid format, etc.)
    """
    try:
        # Supabase access tokens use HS256 with JWT secret
        # The JWT secret is typically the same as SUPABASE_SERVICE_ROLE_KEY
        # But we can also use SUPABASE_ANON_KEY for access tokens
        # Try service role key first (more likely to work)
        jwt_secret = Config.SUPABASE_SERVICE_ROLE_KEY
        
        try:
            decoded = jwt.decode(
                token,
                jwt_secret,
                algorithms=['HS256'],
                options={'verify_exp': True}
            )
        except jwt.InvalidSignatureError:
            # Try anon key if service role key doesn't work
            jwt_secret = Config.SUPABASE_ANON_KEY
            try:
                decoded = jwt.decode(
                    token,
                    jwt_secret,
                    algorithms=['HS256'],
                    options={'verify_exp': True}
                )
            except jwt.InvalidSignatureError:
                # Signature verification failed with both keys - raise ValueError to trigger fallback
                raise ValueError('Signature verification failed')
        except jwt.ExpiredSignatureError:
            raise create_error('Token expired', 401)
        
        # Verify issuer (Supabase)
        # Supabase tokens typically have issuer as the auth URL
        token_issuer = decoded.get('iss', '')
        expected_issuer = Config.SUPABASE_URL.rstrip('/')
        if token_issuer and token_issuer != expected_issuer:
            # Sometimes issuer includes /auth/v1, check that too
            if not token_issuer.startswith(expected_issuer):
                raise create_error('Invalid token issuer', 401)
        
        return decoded
    except ValueError:
        # Re-raise ValueError for signature failures (caller should fall back to remote)
        raise
    except jwt.ExpiredSignatureError:
        raise create_error('Token expired', 401)
    except jwt.InvalidTokenError as e:
        raise create_error(f'Invalid token: {str(e)}', 401)
    except Exception as e:
        # Re-raise AppError instances
        from middleware.error_handler import AppError
        if isinstance(e, AppError):
            raise
        raise create_error(f'Token verification failed: {str(e)}', 401)

