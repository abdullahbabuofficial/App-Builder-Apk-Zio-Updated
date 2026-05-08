-- ============================================
-- ApkZio Database Performance Analysis
-- ============================================

-- 1. Enable query timing (run as superuser)
-- ALTER DATABASE apkzio SET log_min_duration_statement = 100;

-- 2. Enable pg_stat_statements extension (if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================
-- Slow Query Analysis
-- ============================================

-- Find slow queries (>100ms average)
SELECT 
  SUBSTRING(query, 1, 80) AS short_query,
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
  ROUND(max_exec_time::numeric, 2) AS max_time_ms,
  ROUND(stddev_exec_time::numeric, 2) AS stddev_time_ms,
  ROUND((100 * total_exec_time / SUM(total_exec_time) OVER ())::numeric, 2) AS percent_total
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY total_exec_time DESC
LIMIT 20;

-- ============================================
-- Missing Indexes Detection
-- ============================================

-- Find tables with high sequential scan rates
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  CASE 
    WHEN seq_scan > 0 THEN ROUND((seq_tup_read::numeric / seq_scan), 2)
    ELSE 0
  END AS avg_seq_read,
  ROUND((100.0 * seq_tup_read / NULLIF(seq_tup_read + idx_tup_fetch, 0))::numeric, 2) AS seq_scan_pct
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND seq_tup_read > 1000  -- Filter out small tables
ORDER BY seq_tup_read DESC
LIMIT 10;

-- Tables without any indexes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE pg_indexes.tablename = pg_tables.tablename
  )
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- Table and Index Bloat
-- ============================================

-- Table sizes with bloat estimation
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  CASE 
    WHEN n_live_tup > 0 THEN ROUND((100.0 * n_dead_tup / (n_live_tup + n_dead_tup))::numeric, 2)
    ELSE 0
  END AS dead_row_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 15;

-- Unused indexes (never scanned)
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) AS size,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'  -- Exclude primary keys
ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC;

-- ============================================
-- Connection and Lock Analysis
-- ============================================

-- Active connections by state
SELECT 
  state,
  COUNT(*) AS connections,
  MAX(EXTRACT(EPOCH FROM (now() - state_change))) AS max_age_seconds
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state
ORDER BY connections DESC;

-- Long-running queries (>5 seconds)
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  EXTRACT(EPOCH FROM (now() - query_start)) AS duration_seconds,
  state,
  wait_event_type,
  wait_event,
  SUBSTRING(query, 1, 100) AS query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 seconds'
  AND datname = current_database()
ORDER BY duration_seconds DESC;

-- Blocking queries
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- ============================================
-- Cache Hit Ratios
-- ============================================

-- Buffer cache hit ratio (should be >99%)
SELECT 
  ROUND((100.0 * sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0))::numeric, 2) AS cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();

-- Table cache hit ratios
SELECT 
  schemaname,
  tablename,
  ROUND((100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0))::numeric, 2) AS cache_hit_ratio,
  heap_blks_read,
  heap_blks_hit
FROM pg_statio_user_tables
WHERE schemaname = 'public'
  AND (heap_blks_read + heap_blks_hit) > 0
ORDER BY cache_hit_ratio
LIMIT 10;

-- ============================================
-- Recommendations
-- ============================================

-- Print recommendations
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Performance Optimization Recommendations';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  
  -- Check for tables needing VACUUM
  FOR rec IN 
    SELECT tablename, n_dead_tup, n_live_tup
    FROM pg_stat_user_tables
    WHERE n_dead_tup > 1000 
      AND n_dead_tup > n_live_tup * 0.2
    ORDER BY n_dead_tup DESC
    LIMIT 5
  LOOP
    RAISE NOTICE '⚠️  Table "%" needs VACUUM (% dead rows)', rec.tablename, rec.n_dead_tup;
  END LOOP;
  
  -- Check for missing indexes
  FOR rec IN
    SELECT tablename, seq_scan, seq_tup_read
    FROM pg_stat_user_tables
    WHERE seq_scan > 100 AND seq_tup_read > 10000
    ORDER BY seq_tup_read DESC
    LIMIT 3
  LOOP
    RAISE NOTICE '📊 Consider adding index to table "%" (% seq scans, % rows read)', 
      rec.tablename, rec.seq_scan, rec.seq_tup_read;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Analysis complete. Review results above.';
END $$;
