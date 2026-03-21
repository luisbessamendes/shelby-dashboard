# Security & Row-Level Security Rules (CRITICAL)

## Rule: security-rls-sequential-scans

### Why It Matters
Poorly designed RLS policies can force sequential scans on every query, even with indexes.

### Incorrect Example
```sql
-- RLS policy that prevents index usage
CREATE POLICY user_posts ON posts
  FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE email = current_user_email()));
```

**Problem:** Subquery prevents index usage on `user_id`.

### Correct Example
```sql
-- RLS policy that allows index usage
CREATE POLICY user_posts ON posts
  FOR SELECT
  USING (user_id = current_user_id());

-- Ensure index exists
CREATE INDEX idx_posts_user_id ON posts(user_id);
```

**Performance Impact:** 100x faster on large tables

---

## Rule: security-rls-function-volatility

### Why It Matters
Functions marked as VOLATILE prevent query optimization. Use STABLE or IMMUTABLE when possible.

### Incorrect Example
```sql
CREATE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT auth.uid()
$$ LANGUAGE sql VOLATILE; -- Prevents optimization
```

### Correct Example
```sql
CREATE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT auth.uid()
$$ LANGUAGE sql STABLE; -- Allows optimization
```

---

## Rule: security-sql-injection

### Why It Matters
SQL injection is the #1 web application security risk. Always use parameterized queries.

### Incorrect Example
```javascript
// NEVER do this
const email = req.body.email;
const query = `SELECT * FROM users WHERE email = '${email}'`;
await client.query(query);
```

### Correct Example
```javascript
// Use parameterized queries
const email = req.body.email;
const query = 'SELECT * FROM users WHERE email = $1';
await client.query(query, [email]);
```

**Supabase Note:** Supabase client libraries automatically use parameterized queries.
