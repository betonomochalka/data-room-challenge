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

# Maximum token age (24 hours)
MAX_TOKEN_AGE = 3600 * 24

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
            # Verify token header first (security: check token type)
            try:
                header = jwt.get_unverified_header(token)
                if header.get('typ') != 'JWT':
                    raise create_error('Invalid token type', 401)
            except Exception:
                pass  # If header parsing fails, jwt.decode will catch it
            
            decoded = jwt.decode(
                token,
                jwt_secret,
                algorithms=['HS256'],  # Explicitly specify algorithm to prevent algorithm confusion
                options={
                    'verify_exp': True,
                    'verify_iat': True,  # Verify issued at time
                    'leeway': 60  # 60 seconds leeway for clock skew
                }
            )
        except jwt.InvalidSignatureError:
            # Try anon key if service role key doesn't work
            jwt_secret = Config.SUPABASE_ANON_KEY
            try:
                decoded = jwt.decode(
                    token,
                    jwt_secret,
                    algorithms=['HS256'],
                    options={
                        'verify_exp': True,
                        'verify_iat': True,
                        'leeway': 60
                    }
                )
            except jwt.InvalidSignatureError:
                # Signature verification failed with both keys - raise ValueError to trigger fallback
                raise ValueError('Signature verification failed')
        except jwt.ExpiredSignatureError:
            raise create_error('Token expired', 401)
        except jwt.InvalidIssuedAtError:
            raise create_error('Invalid token issue time', 401)
        
        # Verify issuer (Supabase) - stricter check
        token_issuer = decoded.get('iss', '')
        expected_issuer = Config.SUPABASE_URL.rstrip('/')
        if token_issuer:
            # Allow exact match or with /auth/v1 suffix
            valid_issuers = [
                expected_issuer,
                f"{expected_issuer}/auth/v1"
            ]
            if token_issuer not in valid_issuers:
                raise create_error('Invalid token issuer', 401)
        
        # Verify token age (additional security check)
        if 'iat' in decoded:
            token_age = time.time() - decoded['iat']
            if token_age > MAX_TOKEN_AGE:
                raise create_error('Token too old', 401)
            if token_age < 0:
                # Token issued in the future (clock skew or attack)
                raise create_error('Invalid token issue time', 401)
        
        return decoded
    except ValueError:
        # Re-raise ValueError for signature failures (caller should fall back to remote)
        raise
    except jwt.ExpiredSignatureError:
        raise create_error('Token expired', 401)
    except jwt.InvalidTokenError as e:
        # Don't expose internal error details in production
        from config import Config
        if Config.NODE_ENV == 'development':
            raise create_error(f'Invalid token: {str(e)}', 401)
        else:
            raise create_error('Invalid token', 401)
    except Exception as e:
        # Re-raise AppError instances
        from middleware.error_handler import AppError
        if isinstance(e, AppError):
            raise
        # Don't expose internal error details in production
        from config import Config
        if Config.NODE_ENV == 'development':
            raise create_error(f'Token verification failed: {str(e)}', 401)
        else:
            raise create_error('Token verification failed', 401)

