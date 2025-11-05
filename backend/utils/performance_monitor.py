"""
Performance monitoring utility for SQLAlchemy queries
Tracks query execution times and aggregates statistics
"""
import time
import threading
from collections import defaultdict
from sqlalchemy import event
from sqlalchemy.engine import Engine

# Thread-local storage for request-specific query tracking
_local = threading.local()

# Global storage for aggregated statistics (last 20 runs)
_query_stats = []
_max_runs = 20

def init_performance_monitoring():
    """Initialize SQLAlchemy query event listeners"""
    @event.listens_for(Engine, "before_cursor_execute")
    def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Record start time before query execution"""
        conn.info.setdefault('query_start_time', []).append(time.perf_counter())
    
    @event.listens_for(Engine, "after_cursor_execute")
    def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Record query execution time and details"""
        if not hasattr(_local, 'queries'):
            _local.queries = []
        
        total = time.perf_counter() - conn.info['query_start_time'].pop(-1)
        
        # Extract SQL (limit length for readability)
        sql = statement[:200] if len(statement) > 200 else statement
        
        duration_ms = total * 1000
        
        # Log individual query timing
        from flask import g
        if getattr(g, 'log_request_timing', False):
            print(f"[query.timing] {duration_ms:.1f}ms - {sql[:100]}...")
        
        _local.queries.append({
            'sql': sql,
            'duration_ms': duration_ms,
            'parameters': str(parameters)[:100] if parameters else None
        })

def start_request_timing():
    """Start timing for a request"""
    _local.start_time = time.perf_counter()
    _local.queries = []

def end_request_timing():
    """End timing for a request and return statistics"""
    if not hasattr(_local, 'start_time'):
        return None
    
    total_time = time.perf_counter() - _local.start_time
    queries = getattr(_local, 'queries', [])
    
    stats = {
        'total_time_ms': total_time * 1000,
        'query_count': len(queries),
        'queries': queries.copy(),
        'total_query_time_ms': sum(q['duration_ms'] for q in queries)
    }
    
    # Clean up
    if hasattr(_local, 'start_time'):
        delattr(_local, 'start_time')
    if hasattr(_local, 'queries'):
        delattr(_local, 'queries')
    
    return stats

def record_stats(stats):
    """Record statistics for aggregation (keeps last 20 runs)"""
    global _query_stats
    
    _query_stats.append(stats)
    
    # Keep only last 20 runs
    if len(_query_stats) > _max_runs:
        _query_stats.pop(0)
    
    # Print aggregated stats after 20 runs
    if len(_query_stats) == _max_runs:
        print_aggregated_stats()

def print_aggregated_stats():
    """Print aggregated statistics across all recorded runs"""
    global _query_stats
    
    if not _query_stats:
        return
    
    print("\n" + "="*80)
    print("PERFORMANCE MONITORING REPORT (Last 20 Runs)")
    print("="*80)
    
    total_runs = len(_query_stats)
    avg_total_time = sum(s['total_time_ms'] for s in _query_stats) / total_runs
    avg_query_count = sum(s['query_count'] for s in _query_stats) / total_runs
    avg_query_time = sum(s['total_query_time_ms'] for s in _query_stats) / total_runs
    
    print(f"\nOverall Statistics:")
    print(f"  Total Runs: {total_runs}")
    print(f"  Average Total Time: {avg_total_time:.2f}ms")
    print(f"  Average Query Count: {avg_query_count:.2f}")
    print(f"  Average Total Query Time: {avg_query_time:.2f}ms")
    
    # Aggregate queries by SQL pattern
    query_patterns = defaultdict(list)
    for stats in _query_stats:
        for query in stats['queries']:
            # Simplify SQL for grouping (remove IDs, etc.)
            sql_pattern = query['sql'][:100]
            query_patterns[sql_pattern].append(query['duration_ms'])
    
    print(f"\nQuery Patterns (aggregated):")
    for pattern, durations in sorted(query_patterns.items(), key=lambda x: sum(x[1])/len(x[1]), reverse=True)[:10]:
        avg_duration = sum(durations) / len(durations)
        max_duration = max(durations)
        count = len(durations)
        print(f"  [{count} calls] Avg: {avg_duration:.2f}ms, Max: {max_duration:.2f}ms")
        print(f"    SQL: {pattern}...")
    
    print("\n" + "="*80 + "\n")

def get_current_stats():
    """Get current request statistics without ending timing"""
    if not hasattr(_local, 'start_time'):
        return None
    
    queries = getattr(_local, 'queries', [])
    elapsed = (time.perf_counter() - _local.start_time) * 1000
    
    return {
        'elapsed_time_ms': elapsed,
        'query_count': len(queries),
        'queries': queries.copy()
    }

