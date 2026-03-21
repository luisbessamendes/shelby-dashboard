# Schema Design Rules (HIGH)

## Rule: schema-partial-indexes

### Why It Matters
Partial indexes are smaller and faster for queries that filter on specific conditions.

### Incorrect Example
```sql
-- Full index on all rows
CREATE INDEX idx_orders_status ON orders(status);
```

### Correct Example
```sql
-- Partial index only on pending orders
CREATE INDEX idx_orders_pending ON orders(status) 
WHERE status = 'pending';
```

**Performance Impact:** 10x smaller index, faster queries on pending orders

---

## Rule: schema-composite-indexes

### Why It Matters
Multi-column indexes support queries filtering on multiple columns. Column order matters.

### Incorrect Example
```sql
-- Separate indexes
CREATE INDEX idx_users_country ON users(country);
CREATE INDEX idx_users_city ON users(city);

-- Query cannot use both efficiently
SELECT * FROM users WHERE country = 'US' AND city = 'NYC';
```

### Correct Example
```sql
-- Composite index (most selective column first)
CREATE INDEX idx_users_country_city ON users(country, city);

-- Query uses single composite index
SELECT * FROM users WHERE country = 'US' AND city = 'NYC';
```

**Rule:** Order columns by selectivity (most selective first).

---

## Rule: schema-uuid-vs-serial

### Why It Matters
UUIDs are better for distributed systems but have performance trade-offs.

### Trade-offs
**SERIAL/BIGSERIAL:**
- ✅ Smaller (4-8 bytes vs 16 bytes)
- ✅ Faster inserts and joins
- ❌ Not globally unique
- ❌ Predictable (security concern)

**UUID:**
- ✅ Globally unique
- ✅ Unpredictable (better security)
- ❌ Larger (16 bytes)
- ❌ Slower inserts (random order causes index fragmentation)

### Recommendation
Use UUIDs for distributed systems or when exposing IDs in URLs. Use SERIAL for internal tables with high insert rates.

---

## Rule: schema-normalization

### Why It Matters
Proper normalization reduces data redundancy and update anomalies.

### Incorrect Example
```sql
-- Denormalized: Duplicate author data
CREATE TABLE posts (
  id serial PRIMARY KEY,
  title text,
  author_name text,
  author_email text,
  author_bio text
);
```

### Correct Example
```sql
-- Normalized: Separate authors table
CREATE TABLE authors (
  id serial PRIMARY KEY,
  name text,
  email text,
  bio text
);

CREATE TABLE posts (
  id serial PRIMARY KEY,
  title text,
  author_id int REFERENCES authors(id)
);
```

**Note:** Denormalization can be appropriate for read-heavy workloads, but normalize first.
