"""
Rate limiting utility for JWT verification
Protects against brute force attacks and DoS
"""
from collections import defaultdict
from threading import Lock
import time
from typing import Optional
from flask import request

# In-memory storage for rate limiting
# In production, consider using Redis for distributed systems
_failed_attempts: dict[str, list[float]] = defaultdict(list)
_lock = Lock()

# Configuration
MAX_FAILED_ATTEMPTS = 10  # Maximum failed attempts per window
RATE_LIMIT_WINDOW = 300  # 5 minutes in seconds
MAX_FALLBACK_ATTEMPTS = 5  # Maximum fallback attempts per window
FALLBACK_WINDOW = 60  # 1 minute for fallback attempts


def get_client_identifier() -> str:
    """
    Get unique identifier for rate limiting
    Uses IP address, but can be extended to use user ID if available
    """
    # Try to get IP from various headers (for proxies/load balancers)
    ip = (
        request.headers.get('X-Forwarded-For', '').split(',')[0].strip() or
        request.headers.get('X-Real-IP', '') or
        request.remote_addr or
        'unknown'
    )
    return ip


def check_rate_limit(identifier: Optional[str] = None) -> tuple[bool, Optional[str]]:
    """
    Check if client has exceeded rate limit
    
    Returns:
        (allowed, error_message)
        - allowed: True if request is allowed, False if rate limited
        - error_message: Error message if rate limited, None otherwise
    """
    if identifier is None:
        identifier = get_client_identifier()
    
    now = time.time()
    
    with _lock:
        attempts = _failed_attempts[identifier]
        
        # Remove old attempts outside the window
        attempts[:] = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
        
        if len(attempts) >= MAX_FAILED_ATTEMPTS:
            return False, 'Too many failed authentication attempts. Please try again later.'
        
        return True, None


def record_failed_attempt(identifier: Optional[str] = None) -> None:
    """Record a failed authentication attempt"""
    if identifier is None:
        identifier = get_client_identifier()
    
    now = time.time()
    
    with _lock:
        _failed_attempts[identifier].append(now)
        
        # Clean up old entries periodically (keep only last hour)
        if len(_failed_attempts) > 1000:
            cutoff = now - 3600  # 1 hour
            for key in list(_failed_attempts.keys()):
                attempts = _failed_attempts[key]
                attempts[:] = [t for t in attempts if t > cutoff]
                if not attempts:
                    del _failed_attempts[key]


def check_fallback_rate_limit(identifier: Optional[str] = None) -> tuple[bool, Optional[str]]:
    """
    Check rate limit specifically for fallback requests (remote Supabase calls)
    More restrictive to prevent DoS attacks on Supabase API
    """
    if identifier is None:
        identifier = get_client_identifier()
    
    now = time.time()
    fallback_key = f"{identifier}:fallback"
    
    with _lock:
        attempts = _failed_attempts[fallback_key]
        
        # Remove old attempts outside the window
        attempts[:] = [t for t in attempts if now - t < FALLBACK_WINDOW]
        
        if len(attempts) >= MAX_FALLBACK_ATTEMPTS:
            return False, 'Too many authentication attempts. Please try again later.'
        
        return True, None


def record_fallback_attempt(identifier: Optional[str] = None) -> None:
    """Record a fallback authentication attempt"""
    if identifier is None:
        identifier = get_client_identifier()
    
    now = time.time()
    fallback_key = f"{identifier}:fallback"
    
    with _lock:
        _failed_attempts[fallback_key].append(now)


def reset_rate_limit(identifier: Optional[str] = None) -> None:
    """Reset rate limit for a client (e.g., after successful authentication)"""
    if identifier is None:
        identifier = get_client_identifier()
    
    with _lock:
        if identifier in _failed_attempts:
            del _failed_attempts[identifier]
        fallback_key = f"{identifier}:fallback"
        if fallback_key in _failed_attempts:
            del _failed_attempts[fallback_key]
