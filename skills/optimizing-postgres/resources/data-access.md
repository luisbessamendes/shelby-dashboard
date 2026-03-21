# Data Access Patterns (MEDIUM)

## Rule: data-pagination

### Why It Matters
Loading all rows wastes memory and network bandwidth. Always paginate large result sets.

### Incorrect Example
```sql
-- Loads all rows into memory
SELECT * FROM posts ORDER BY created_at DESC;
```

### Correct Example
```sql
-- Cursor-based pagination (preferred)
SELECT * FROM posts 
WHERE created_at < '2024-01-01'
ORDER BY created_at DESC 
LIMIT 20;

-- Offset pagination (simpler but slower for large offsets)
SELECT * FROM posts 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 100;
```

**Best Practice:** Use cursor-based pagination for large datasets.

---

## Rule: data-batch-operations

### Why It Matters
Batch operations reduce round trips and transaction overhead.

### Incorrect Example
```javascript
// N separate queries
for (const user of users) {
  await client.query('INSERT INTO users (name, email) VALUES ($1, $2)', 
    [user.name, user.email]);
}
```

### Correct Example
```javascript
// Single batch insert
const values = users.map(u => `('${u.name}', '${u.email}')`).join(',');
await client.query(`INSERT INTO users (name, email) VALUES ${values}`);

// Or use COPY for very large batches
```

**Performance Impact:** 100x faster for 1000 inserts

---

## Rule: data-json-vs-relational

### Why It Matters
JSONB is flexible but slower than relational columns for structured data.

### When to Use JSONB
- Schema varies per row
- Nested/hierarchical data
- Rapid prototyping

### When to Use Relational
- Fixed schema
- Need to index/query specific fields
- Performance-critical queries

### Example
```sql
-- Good use of JSONB: Variable metadata
CREATE TABLE products (
  id serial PRIMARY KEY,
  name text,
  metadata jsonb -- Varies per product type
);

-- Bad use of JSONB: Fixed schema
CREATE TABLE users (
  id serial PRIMARY KEY,
  data jsonb -- Should be separate columns
);
```
