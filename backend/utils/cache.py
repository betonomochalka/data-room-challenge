"""
Caching utilities with Redis support and graceful fallback
Provides cache-aware invalidation for data consistency
"""
import json
import threading
from functools import wraps
from typing import Optional, Any, Callable, List
import time

# Try to import Redis, fallback to in-memory cache if not available
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

from config import Config

class InMemoryCache:
    """Thread-safe in-memory cache fallback when Redis is not available"""
    
    def __init__(self):
        self._cache = {}
        self._lock = threading.RLock()
        self._expiry = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        with self._lock:
            # Check if expired
            if key in self._expiry:
                if time.time() > self._expiry[key]:
                    self.delete(key)
                    return None
            
            return self._cache.get(key)
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with optional TTL (in seconds)"""
        try:
            with self._lock:
                self._cache[key] = value
                if ttl:
                    self._expiry[key] = time.time() + ttl
                else:
                    self._expiry.pop(key, None)
                return True
        except Exception:
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            with self._lock:
                self._cache.pop(key, None)
                self._expiry.pop(key, None)
                return True
        except Exception:
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern (supports wildcard *)"""
        deleted = 0
        with self._lock:
            keys_to_delete = []
            for key in self._cache.keys():
                # Simple wildcard matching
                if pattern.endswith('*'):
                    prefix = pattern[:-1]
                    if key.startswith(prefix):
                        keys_to_delete.append(key)
                elif pattern == key:
                    keys_to_delete.append(key)
            
            for key in keys_to_delete:
                self.delete(key)
                deleted += 1
        
        return deleted
    
    def clear(self) -> bool:
        """Clear all cache"""
        try:
            with self._lock:
                self._cache.clear()
                self._expiry.clear()
                return True
        except Exception:
            return False
    
    def get_many(self, keys: List[str]) -> dict:
        """Get multiple keys at once"""
        result = {}
        with self._lock:
            for key in keys:
                value = self.get(key)
                if value is not None:
                    result[key] = value
        return result


class CacheManager:
    """Cache manager with Redis support and fallback"""
    
    def __init__(self):
        self._redis_client = None
        self._memory_cache = InMemoryCache()
        self._use_redis = False
        self._cache_prefix = 'dataroom:'
        
        # Initialize Redis if available
        if REDIS_AVAILABLE:
            self._init_redis()
        else:
            print('Redis not available, using in-memory cache')
    
    def _init_redis(self):
        """Initialize Redis connection"""
        try:
            redis_url = getattr(Config, 'REDIS_URL', None)
            if redis_url:
                self._redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                    health_check_interval=30
                )
                # Test connection
                self._redis_client.ping()
                self._use_redis = True
                print('Redis cache initialized successfully')
            else:
                print('REDIS_URL not configured, using in-memory cache')
        except Exception as e:
            print(f'Redis initialization failed: {e}, using in-memory cache')
            self._redis_client = None
            self._use_redis = False
    
    def _make_key(self, key: str, tags: Optional[List[str]] = None) -> str:
        """Create cache key with prefix and optional tags"""
        full_key = f"{self._cache_prefix}{key}"
        
        # Store tags for invalidation (only with Redis)
        if tags and self._use_redis:
            tag_key = f"{full_key}:tags"
            try:
                self._redis_client.sadd(tag_key, *tags)
                self._redis_client.expire(tag_key, 86400)  # 24 hours
            except Exception:
                pass  # Fail silently for tag storage
        
        return full_key
    
    def get(self, key: str, tags: Optional[List[str]] = None) -> Optional[Any]:
        """Get value from cache"""
        cache_key = self._make_key(key, tags)
        
        try:
            if self._use_redis:
                value = self._redis_client.get(cache_key)
                if value:
                    return json.loads(value)
            else:
                return self._memory_cache.get(cache_key)
        except Exception as e:
            print(f'Cache get error: {e}')
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None, tags: Optional[List[str]] = None) -> bool:
        """Set value in cache with optional TTL and tags"""
        cache_key = self._make_key(key, tags)
        
        try:
            if self._use_redis:
                json_value = json.dumps(value, default=str)
                if ttl:
                    return self._redis_client.setex(cache_key, ttl, json_value)
                else:
                    return self._redis_client.set(cache_key, json_value)
            else:
                return self._memory_cache.set(cache_key, value, ttl)
        except Exception as e:
            print(f'Cache set error: {e}')
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        cache_key = self._make_key(key)
        
        try:
            if self._use_redis:
                return bool(self._redis_client.delete(cache_key))
            else:
                return self._memory_cache.delete(cache_key)
        except Exception as e:
            print(f'Cache delete error: {e}')
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern"""
        full_pattern = f"{self._cache_prefix}{pattern}"
        
        try:
            if self._use_redis:
                deleted = 0
                # Use SCAN for safe iteration
                cursor = 0
                while True:
                    cursor, keys = self._redis_client.scan(cursor, match=full_pattern, count=100)
                    if keys:
                        deleted += self._redis_client.delete(*keys)
                    if cursor == 0:
                        break
                return deleted
            else:
                return self._memory_cache.delete_pattern(full_pattern)
        except Exception as e:
            print(f'Cache delete_pattern error: {e}')
            return 0
    
    def invalidate_by_tags(self, tags: List[str]) -> int:
        """Invalidate all cache entries with given tags (Redis only)"""
        if not self._use_redis:
            return 0
        
        deleted = 0
        try:
            for tag in tags:
                tag_pattern = f"{self._cache_prefix}*:tags"
                cursor = 0
                while True:
                    cursor, tag_keys = self._redis_client.scan(cursor, match=tag_pattern, count=100)
                    for tag_key in tag_keys:
                        if self._redis_client.sismember(tag_key, tag):
                            # Get the cache key (remove :tags suffix)
                            cache_key = tag_key.replace(':tags', '')
                            if self._redis_client.delete(cache_key):
                                deleted += 1
                            self._redis_client.delete(tag_key)
                    if cursor == 0:
                        break
        except Exception as e:
            print(f'Cache invalidate_by_tags error: {e}')
        
        return deleted
    
    def clear(self) -> bool:
        """Clear all cache"""
        try:
            if self._use_redis:
                pattern = f"{self._cache_prefix}*"
                self.delete_pattern(pattern)
                return True
            else:
                return self._memory_cache.clear()
        except Exception as e:
            print(f'Cache clear error: {e}')
            return False


# Global cache instance
_cache = CacheManager()


def get_cache_key(entity_type: str, entity_id: Optional[str] = None, **kwargs) -> str:
    """Generate consistent cache keys"""
    parts = [entity_type]
    
    if entity_id:
        parts.append(str(entity_id))
    
    # Add additional parameters sorted for consistency
    if kwargs:
        sorted_kwargs = sorted(kwargs.items())
        param_str = ':'.join(f"{k}={v}" for k, v in sorted_kwargs if v is not None)
        if param_str:
            parts.append(param_str)
    
    return ':'.join(parts)


def get_cache_tags(entity_type: str, entity_id: Optional[str] = None, 
                   data_room_id: Optional[str] = None,
                   user_id: Optional[str] = None) -> List[str]:
    """Generate cache tags for invalidation"""
    tags = []
    
    if entity_type:
        tags.append(f"type:{entity_type}")
    
    if entity_id:
        tags.append(f"{entity_type}:{entity_id}")
    
    if data_room_id:
        tags.append(f"dataroom:{data_room_id}")
        tags.append(f"type:dataroom:{data_room_id}")
    
    if user_id:
        tags.append(f"user:{user_id}")
    
    return tags


def invalidate_cache(entity_type: str, entity_id: Optional[str] = None,
                    data_room_id: Optional[str] = None,
                    user_id: Optional[str] = None,
                    related_entities: Optional[List[tuple]] = None) -> int:
    """
    Invalidate cache entries based on entity changes
    
    Args:
        entity_type: Type of entity (e.g., 'dataroom', 'folder', 'file')
        entity_id: ID of the entity
        data_room_id: Data room ID for related invalidation
        user_id: User ID for related invalidation
        related_entities: List of (entity_type, entity_id) tuples for related invalidations
    
    Returns:
        Number of cache entries invalidated
    """
    deleted = 0
    
    # Invalidate specific entity
    if entity_id:
        key = get_cache_key(entity_type, entity_id)
        if _cache.delete(key):
            deleted += 1
    
    # Invalidate by tags
    tags = get_cache_tags(entity_type, entity_id, data_room_id, user_id)
    deleted += _cache.invalidate_by_tags(tags)
    
    # Invalidate related entities
    if related_entities:
        for rel_type, rel_id in related_entities:
            if rel_type and rel_id:  # Skip None values
                key = get_cache_key(rel_type, rel_id)
                if _cache.delete(key):
                    deleted += 1
    
    # Invalidate list queries
    if data_room_id:
        # Invalidate all list queries for this data room
        # Match patterns like: folder:list:dataRoomId=xxx, folder:*:dataRoomId=xxx
        patterns = [
            f"{entity_type}:list:*",
            f"{entity_type}:*:dataRoomId={data_room_id}*",
            f"{entity_type}:*:dataroom={data_room_id}*",
        ]
        for pattern in patterns:
            deleted += _cache.delete_pattern(pattern)
    
    return deleted


def cache_result(ttl: int = 300, key_func: Optional[Callable] = None, 
                tags_func: Optional[Callable] = None):
    """
    Decorator to cache function results
    
    Args:
        ttl: Time to live in seconds (default: 5 minutes)
        key_func: Function to generate cache key from args/kwargs
        tags_func: Function to generate cache tags from args/kwargs
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                # Default key generation
                key_parts = [func.__name__]
                if args:
                    key_parts.extend(str(arg) for arg in args)
                if kwargs:
                    sorted_kwargs = sorted(kwargs.items())
                    key_parts.extend(f"{k}={v}" for k, v in sorted_kwargs if v is not None)
                cache_key = ':'.join(key_parts)
            
            # Generate tags
            tags = None
            if tags_func:
                tags = tags_func(*args, **kwargs)
            
            # Try to get from cache
            cached = _cache.get(cache_key, tags)
            if cached is not None:
                return cached
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Cache result
            _cache.set(cache_key, result, ttl, tags)
            
            return result
        
        return wrapper
    return decorator


# Convenience functions
def get_cache() -> CacheManager:
    """Get the global cache instance"""
    return _cache


def cache_get(key: str, tags: Optional[List[str]] = None) -> Optional[Any]:
    """Get from cache"""
    return _cache.get(key, tags)


def cache_set(key: str, value: Any, ttl: Optional[int] = None, tags: Optional[List[str]] = None) -> bool:
    """Set in cache"""
    return _cache.set(key, value, ttl, tags)


def cache_delete(key: str) -> bool:
    """Delete from cache"""
    return _cache.delete(key)

