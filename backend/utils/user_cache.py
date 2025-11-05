"""
User lookup cache with TTL
Caches supabase_uid→userId mapping to avoid database queries on every request
"""
import time
from threading import Lock
from typing import Optional, Dict

# In-memory cache: supabase_uid -> (user_id, expiry_time)
_cache: Dict[str, tuple] = {}
_cache_lock = Lock()
_cache_ttl = 300  # 5 minutes TTL

def get_user_id_from_cache(supabase_uid: str) -> Optional[str]:
    """Get user ID from cache if available and not expired"""
    with _cache_lock:
        if supabase_uid in _cache:
            user_id, expiry = _cache[supabase_uid]
            if time.time() < expiry:
                return user_id
            else:
                # Expired, remove from cache
                del _cache[supabase_uid]
        return None

def set_user_id_in_cache(supabase_uid: str, user_id: str):
    """Store user ID in cache with TTL"""
    with _cache_lock:
        expiry = time.time() + _cache_ttl
        _cache[supabase_uid] = (user_id, expiry)

def clear_user_cache(supabase_uid: Optional[str] = None):
    """Clear cache for specific supabase_uid or entire cache"""
    with _cache_lock:
        if supabase_uid:
            _cache.pop(supabase_uid, None)
        else:
            _cache.clear()

