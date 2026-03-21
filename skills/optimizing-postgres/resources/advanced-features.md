# Advanced Features (LOW)

## Rule: advanced-full-text-search

### Why It Matters
Full-text search is much faster than LIKE queries for text search.

### Implementation
```sql
-- Add tsvector column
ALTER TABLE articles ADD COLUMN search_vector tsvector;

-- Populate search vector
UPDATE articles 
SET search_vector = to_tsvector('english', title || ' ' || body);

-- Create GIN index
CREATE INDEX idx_articles_search ON articles USING gin(search_vector);

-- Search
SELECT * FROM articles 
WHERE search_vector @@ to_tsquery('english', 'postgres & performance');
```

**Performance Impact:** 1000x faster than LIKE on large text

---

## Rule: advanced-materialized-views

### Why It Matters
Materialized views cache expensive query results.

### Implementation
```sql
-- Create materialized view
CREATE MATERIALIZED VIEW user_stats AS
SELECT 
  user_id,
  count(*) AS post_count,
  max(created_at) AS last_post_at
FROM posts
GROUP BY user_id;

-- Create index on materialized view
CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);

-- Refresh periodically
REFRESH MATERIALIZED VIEW user_stats;
```

**Use Case:** Dashboard queries, analytics, reports

---

## Rule: advanced-partitioning

### Why It Matters
Partitioning improves query performance on very large tables by splitting data into smaller chunks.

### Implementation
```sql
-- Create partitioned table
CREATE TABLE events (
  id serial,
  event_type text,
  created_at timestamp,
  data jsonb
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE events_2024_01 PARTITION OF events
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE events_2024_02 PARTITION OF events
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

**Use Case:** Time-series data, audit logs, very large tables (>100M rows)

---

## Rule: advanced-triggers

### Why It Matters
Triggers automate data validation and updates but can impact performance.

### Best Practices
- Keep triggers simple and fast
- Avoid complex logic in triggers
- Consider using application logic instead
- Use AFTER triggers for non-critical operations

### Example
```sql
-- Update timestamp on row change
CREATE TRIGGER update_modified_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at_column();
```
