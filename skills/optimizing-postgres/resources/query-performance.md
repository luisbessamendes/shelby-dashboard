# Query Performance Rules (CRITICAL)

## Rule: query-missing-indexes

### Why It Matters
Missing indexes cause full table scans, which are extremely slow on large tables. Every query should use an index when filtering or joining.

### Incorrect Example
```sql
-- Sequential scan on large table
SELECT * FROM users WHERE email = 'user@example.com';
```

**EXPLAIN Output:**
```
Seq Scan on users  (cost=0.00..1693.00 rows=1 width=100)
  Filter: (email = 'user@example.com'::text)
```

### Correct Example
```sql
-- Create index first
CREATE INDEX idx_users_email ON users(email);

-- Now uses index scan
SELECT * FROM users WHERE email = 'user@example.com';
```

**EXPLAIN Output:**
```
Index Scan using idx_users_email on users  (cost=0.42..8.44 rows=1 width=100)
  Index Cond: (email = 'user@example.com'::text)
```

**Performance Impact:** 200x faster on 100k rows

---

## Rule: query-select-star

### Why It Matters
`SELECT *` fetches unnecessary columns, wasting network bandwidth and memory. Only select columns you need.

### Incorrect Example
```sql
SELECT * FROM users WHERE id = 123;
```

### Correct Example
```sql
SELECT id, name, email FROM users WHERE id = 123;
```

**Performance Impact:** 50-80% reduction in data transfer

---

## Rule: query-n-plus-one

### Why It Matters
N+1 queries execute one query per row instead of joining data upfront. This multiplies database round trips.

### Incorrect Example
```sql
-- First query
SELECT * FROM posts;

-- Then N queries (one per post)
SELECT * FROM comments WHERE post_id = 1;
SELECT * FROM comments WHERE post_id = 2;
-- ... repeated N times
```

### Correct Example
```sql
-- Single query with JOIN
SELECT 
  posts.*,
  comments.id AS comment_id,
  comments.body AS comment_body
FROM posts
LEFT JOIN comments ON comments.post_id = posts.id;
```

**Performance Impact:** 100x faster for 100 posts

---

## Rule: query-inefficient-like

### Why It Matters
Leading wildcards (`LIKE '%term'`) cannot use indexes and force full table scans.

### Incorrect Example
```sql
SELECT * FROM products WHERE name LIKE '%phone%';
```

### Correct Example
```sql
-- Option 1: Use full-text search
CREATE INDEX idx_products_name_fts ON products USING gin(to_tsvector('english', name));
SELECT * FROM products WHERE to_tsvector('english', name) @@ to_tsquery('phone');

-- Option 2: If prefix search is acceptable
SELECT * FROM products WHERE name LIKE 'phone%';
CREATE INDEX idx_products_name ON products(name text_pattern_ops);
```

**Performance Impact:** 1000x faster with full-text search on 1M rows
