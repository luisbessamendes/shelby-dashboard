# Monitoring & Diagnostics (LOW-MEDIUM)

## Rule: monitor-slow-queries

### Why It Matters
Identifying slow queries is the first step to optimization.

### Enable Slow Query Logging
```sql
-- Log queries slower than 1 second
ALTER DATABASE mydb SET log_min_duration_statement = 1000;
```

### Find Slow Queries
```sql
-- pg_stat_statements extension (must be enabled)
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Supabase Note:** Use Supabase Dashboard > Database > Query Performance

---

## Rule: monitor-index-usage

### Why It Matters
Unused indexes waste space and slow down writes.

### Find Unused Indexes
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Find Missing Indexes
```sql
-- Tables with sequential scans
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / seq_scan AS avg_seq_tup
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 10;
```

---

## Rule: monitor-connection-pool

### Why It Matters
Connection pool exhaustion causes application errors.

### Check Active Connections
```sql
SELECT 
  count(*) AS total,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx
FROM pg_stat_activity;
```

### Check Max Connections
```sql
SHOW max_connections;
```
