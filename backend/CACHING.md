# Caching and Cache-Aware Invalidation

This document describes the caching system implemented in the Data Room backend.

## Overview

The caching system provides:
- **Redis support** with graceful fallback to in-memory caching
- **Cache-aware invalidation** that automatically invalidates related cache entries
- **Tag-based invalidation** for efficient bulk cache clearing
- **Operational safety** with proper error handling and graceful degradation

## Architecture

### Cache Backend

The system uses a dual-backend approach:

1. **Redis** (preferred): Distributed, persistent caching with tag support
2. **In-Memory Cache** (fallback): Thread-safe Python dictionary when Redis is unavailable

### Cache Keys

Cache keys follow a consistent naming pattern:
- Format: `dataroom:{entity_type}:{entity_id}:{params}`
- Examples:
  - `dataroom:dataroom:user_id=abc123`
  - `dataroom:folder:list:dataRoomId=xyz789`
  - `dataroom:file:list:dataRoomId=xyz789:folderId=def456`

### Cache Tags

Tags enable efficient bulk invalidation:
- `type:{entity_type}` - Invalidates all entries of a type
- `{entity_type}:{entity_id}` - Invalidates specific entity
- `dataroom:{data_room_id}` - Invalidates all entries for a data room
- `user:{user_id}` - Invalidates all entries for a user

## Configuration

### Environment Variables

Add to `backend/.env`:

```env
# Optional: Redis URL (if not provided, uses in-memory cache)
REDIS_URL="redis://localhost:6379/0"

# Cache TTL in seconds (default: 300 = 5 minutes)
CACHE_TTL="300"

# Enable/disable caching (default: true)
CACHE_ENABLED="true"
```

### Installation

Redis is optional. To use Redis:

```bash
pip install redis>=5.0.0
```

Or install with cache extras:
```bash
pip install -r requirements.txt[cache]
```

## Usage

### Basic Caching

```python
from utils.cache import cache_get, cache_set, get_cache_key, get_cache_tags

# Get from cache
cache_key = get_cache_key('dataroom', user_id=user.id)
cache_tags = get_cache_tags('dataroom', user_id=user.id)
cached = cache_get(cache_key, cache_tags)

if cached is None:
    # Fetch from database
    data = fetch_from_db()
    # Store in cache
    cache_set(cache_key, data, ttl=300, tags=cache_tags)
```

### Cache Invalidation

```python
from utils.cache import invalidate_cache

# After creating/updating/deleting an entity
invalidate_cache(
    entity_type='folder',
    entity_id=folder.id,
    data_room_id=folder.data_room_id,
    user_id=user.id,
    related_entities=[
        ('folder', 'list'),  # Invalidate folder list queries
        ('dataroom', folder.data_room_id),  # Invalidate data room cache
    ]
)
```

## Cache Invalidation Strategy

### Automatic Invalidation

The system automatically invalidates related cache entries when:

1. **Creating entities**: Invalidates list queries and parent entity caches
2. **Updating entities**: Invalidates entity cache and related lists
3. **Deleting entities**: Invalidates entity cache, lists, and parent caches

### Invalidation Hierarchy

When an entity is modified, the following are invalidated:

```
Folder Created:
├── folder:{id} (specific folder)
├── folder:list:* (all folder lists)
├── dataroom:{data_room_id} (parent data room)
└── folder:{parent_id}/contents (if in a folder)

File Uploaded:
├── file:{id} (specific file)
├── file:list:* (all file lists)
├── dataroom:{data_room_id} (parent data room)
└── folder:{folder_id}/contents (if in a folder)
```

## Performance Considerations

### Cache TTL

- Default: 5 minutes (300 seconds)
- Configurable via `CACHE_TTL` environment variable
- Shorter TTL for frequently changing data
- Longer TTL for stable data

### Cache Hit Rates

Expected cache hit rates:
- **GET requests**: 70-90% (high for read-heavy workloads)
- **Mutation requests**: Always invalidate (ensures consistency)

### Memory Usage

- **Redis**: Uses Redis memory limits (configurable)
- **In-Memory**: Grows with application memory (monitor in production)

## Operational Guidelines

### Monitoring

1. **Cache Hit Rate**: Monitor Redis `INFO stats` for hit/miss ratios
2. **Memory Usage**: Monitor Redis memory usage
3. **Error Rates**: Watch for cache connection errors

### Troubleshooting

**Cache not working:**
- Check `CACHE_ENABLED=true` in environment
- Verify Redis connection (if using Redis)
- Check application logs for cache errors

**Stale data:**
- Verify invalidation is called after mutations
- Check cache TTL settings
- Ensure Redis is working (if using Redis)

**High memory usage:**
- Reduce cache TTL
- Implement cache size limits
- Monitor cache key patterns

### Production Checklist

- [ ] Redis configured with appropriate memory limits
- [ ] Cache TTL tuned for your workload
- [ ] Monitoring set up for cache hit rates
- [ ] Error handling tested (Redis down scenarios)
- [ ] Cache invalidation verified for all mutation paths

## Implementation Details

### Thread Safety

- **Redis**: Thread-safe by design
- **In-Memory**: Uses `threading.RLock()` for thread safety

### Error Handling

- Cache errors are logged but don't fail requests
- Falls back to database queries if cache fails
- Graceful degradation ensures application continues working

### Consistency

- Cache invalidation happens **after** successful database commits
- Transaction rollback prevents cache invalidation on errors
- Related entities are invalidated together for consistency

## Future Enhancements

Potential improvements:
- Cache warming for frequently accessed data
- Cache compression for large responses
- Distributed cache invalidation for multi-instance deployments
- Cache analytics and metrics

