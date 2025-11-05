"""
Authentication middleware
"""
from functools import wraps
from flask import request, g
from supabase import create_client, Client
from config import Config
from database import db
from models import User
from middleware.error_handler import create_error, AppError
from sqlalchemy.exc import OperationalError, DatabaseError
from utils.user_cache import get_user_id_from_cache, set_user_id_in_cache
from utils.jwt_verifier import verify_supabase_jwt
import time

# Initialize Supabase client for fallback remote verification
supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_ROLE_KEY)

def authenticate_token(f):
    """Decorator to authenticate requests using Supabase JWT tokens"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Track auth timing
        auth_start_time = time.perf_counter()
        request_arrival_time = getattr(g, 'request_start_time', auth_start_time)
        
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            raise create_error('Access token required', 401)
        
        # Extract token from "Bearer TOKEN" format
        try:
            token = auth_header.split(' ')[1]
        except IndexError:
            raise create_error('Invalid authorization header format', 401)
        
        # Try local JWT verification first (fast), fall back to remote if it fails
        token_verify_start = time.perf_counter()
        decoded_token = None
        supabase_uid = None
        email = None
        user_metadata = {}
        used_local_verification = False
        
        try:
            # Try local verification first (avoids ~65-100ms remote call)
            decoded_token = verify_supabase_jwt(token)
            used_local_verification = True
            
            # Extract claims from token
            supabase_uid = decoded_token.get('sub')  # Supabase user ID
            email = decoded_token.get('email')
            user_metadata = decoded_token.get('user_metadata', {})
            
            if not supabase_uid:
                raise create_error('Token missing user ID', 401)
            if not email:
                raise create_error('Token missing email', 401)
                
        except ValueError:
            # Signature verification failed - fall back to remote verification
            print(f'Local JWT verification failed (signature mismatch), falling back to remote')
            try:
                response = supabase.auth.get_user(token)
                if response.user is None:
                    raise create_error('Invalid or expired token', 401)
                
                supabase_uid = response.user.id
                email = response.user.email
                user_metadata = response.user.user_metadata if hasattr(response.user, 'user_metadata') else {}
            except Exception as e2:
                print(f'Remote token verification also failed: {e2}')
                raise create_error('Invalid or expired token', 401)
        except AppError:
            raise  # Re-raise our custom errors (expired, invalid format, etc.)
        except Exception as e:
            # Unexpected error - fall back to remote verification
            print(f'Local JWT verification failed (unexpected error), falling back to remote: {e}')
            try:
                response = supabase.auth.get_user(token)
                if response.user is None:
                    raise create_error('Invalid or expired token', 401)
                
                supabase_uid = response.user.id
                email = response.user.email
                user_metadata = response.user.user_metadata if hasattr(response.user, 'user_metadata') else {}
            except Exception as e2:
                print(f'Remote token verification also failed: {e2}')
                raise create_error('Invalid or expired token', 401)
        
        token_verify_time = (time.perf_counter() - token_verify_start) * 1000
        
        # Find or create user in our database with retry logic
        db_lookup_start = time.perf_counter()
        max_retries = 3
        retry_delay = 0.5  # seconds
        
        for attempt in range(max_retries):
            try:
                # Try cache first (avoids DB query)
                cached_user_id = get_user_id_from_cache(supabase_uid)
                if cached_user_id:
                    # Query by ID (primary key - fastest lookup)
                    user = User.query.get(cached_user_id)
                    if user and user.supabase_uid == supabase_uid:
                        # Attach user to request context
                        g.user = user
                        
                        # Log timing (cached lookup - no DB query)
                        db_lookup_time = (time.perf_counter() - db_lookup_start) * 1000
                        auth_complete_time = time.perf_counter()
                        if getattr(g, 'log_request_timing', False):
                            auth_total_time = (auth_complete_time - auth_start_time) * 1000
                            request_to_auth_time = (auth_start_time - request_arrival_time) * 1000
                            print(f"[middleware.timing] {request.method} {request.path}")
                            print(f"  Request arrival → Auth start: {request_to_auth_time:.1f}ms (body parsing, routing)")
                            print(f"  Auth start → Token verify: {token_verify_time:.1f}ms ({'local HS256' if used_local_verification else 'remote Supabase'})")
                            print(f"  Token verify → DB lookup: {db_lookup_time:.1f}ms (cached, PK lookup)")
                            print(f"  Auth total: {auth_total_time:.1f}ms")
                        
                        g.auth_complete_time = auth_complete_time
                        return f(*args, **kwargs)
                    # Cache invalid - user ID doesn't match, fall through to re-query
                
                # Cache miss or invalid - query database by supabase_uid (indexed, fast)
                user = User.query.filter_by(supabase_uid=supabase_uid).first()
                
                # Fallback to email lookup if supabase_uid not set (for existing users)
                if not user:
                    user = User.query.filter_by(email=email).first()
                    # Update existing user with supabase_uid if found
                    if user and not user.supabase_uid:
                        user.supabase_uid = supabase_uid
                        db.session.commit()
                
                if not user:
                    # Create new user
                    name = user_metadata.get('full_name') if user_metadata else None
                    if not name:
                        name = email.split('@')[0]
                    
                    # Remove nickname in parentheses if present, e.g., "Name Surname (nickname)" -> "Name Surname"
                    import re
                    name = re.sub(r'\s*\([^)]*\)\s*$', '', name).strip() if name else name
                    
                    user = User(
                        email=email,
                        supabase_uid=supabase_uid,
                        name=name
                    )
                    db.session.add(user)
                    db.session.flush()  # Flush to get user.id
                    
                    # Create default Data Room for the user
                    from models import DataRoom
                    default_data_room = DataRoom(
                        name=f'Data Room ({name})',
                        user_id=user.id
                    )
                    db.session.add(default_data_room)
                    db.session.commit()
                    print(f'Created new user in database: {email} (supabase_uid: {supabase_uid})')
                
                # Cache user ID for future requests
                set_user_id_in_cache(supabase_uid, user.id)
                
                # Attach user to request context
                g.user = user
                
                # Calculate timing and log breakdown
                db_lookup_time = (time.perf_counter() - db_lookup_start) * 1000
                auth_complete_time = time.perf_counter()
                
                if getattr(g, 'log_request_timing', False):
                    auth_total_time = (auth_complete_time - auth_start_time) * 1000
                    request_to_auth_time = (auth_start_time - request_arrival_time) * 1000
                    print(f"[middleware.timing] {request.method} {request.path}")
                    print(f"  Request arrival → Auth start: {request_to_auth_time:.1f}ms (body parsing, routing)")
                    print(f"  Auth start → Token verify: {token_verify_time:.1f}ms ({'local HS256' if used_local_verification else 'remote Supabase'})")
                    print(f"  Token verify → DB lookup: {db_lookup_time:.1f}ms")
                    print(f"  Auth total: {auth_total_time:.1f}ms")
                
                g.auth_complete_time = auth_complete_time
                
                return f(*args, **kwargs)
            
            except (OperationalError, DatabaseError) as e:
                # Rollback the session on database error
                db.session.rollback()
                
                # Check if it's a connection timeout/error that we can retry
                error_str = str(e).lower()
                is_retryable = any(keyword in error_str for keyword in [
                    'timeout', 'connection', 'maxclients', 'server closed'
                ])
                
                if is_retryable and attempt < max_retries - 1:
                    # Wait before retrying
                    print(f'Database connection error (attempt {attempt + 1}/{max_retries}): {e}')
                    time.sleep(retry_delay * (attempt + 1))  # Exponential backoff
                    # Invalidate the pool connection to force a new one
                    try:
                        db.session.remove()
                    except Exception:
                        pass
                    continue
                else:
                    # No more retries or non-retryable error
                    print(f'Database error in authenticate_token: {e}')
                    raise create_error('Database connection error. Please try again later.', 503)
            
            except Exception as e:
                # Rollback the session on any other error
                db.session.rollback()
                print(f'Unexpected error in authenticate_token: {e}')
                raise create_error('Authentication error', 500)
    
    return decorated_function

