# Connection Management Rules (CRITICAL)

## Rule: conn-pool-exhaustion

### Why It Matters
Postgres has a limited number of connections (default 100). Without connection pooling, serverless/high-concurrency apps exhaust connections quickly.

### Incorrect Example
```javascript
// Opening new connection per request
const client = new Client({ connectionString });
await client.connect();
const result = await client.query('SELECT * FROM users');
await client.end();
```

### Correct Example
```javascript
// Use connection pooling (pgBouncer or application-level pool)
const pool = new Pool({ 
  connectionString,
  max: 20, // Limit connections
});
const result = await pool.query('SELECT * FROM users');
// Connection automatically returned to pool
```

**Supabase Note:** Use Supabase's connection pooler (port 6543) for serverless functions.

---

## Rule: conn-long-transactions

### Why It Matters
Long-running transactions hold locks and connections, blocking other queries and causing connection pool exhaustion.

### Incorrect Example
```sql
BEGIN;
SELECT * FROM users; -- Takes 30 seconds
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- ... more operations ...
COMMIT; -- Holds connection for entire duration
```

### Correct Example
```sql
-- Keep transactions short and focused
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

**Best Practice:** Transactions should complete in < 1 second.

---

## Rule: conn-idle-in-transaction

### Why It Matters
Connections stuck in "idle in transaction" state hold locks and waste connection slots.

### Detection
```sql
SELECT pid, state, query_start, state_change 
FROM pg_stat_activity 
WHERE state = 'idle in transaction' 
  AND state_change < now() - interval '5 minutes';
```

### Solution
- Always commit or rollback transactions
- Set `idle_in_transaction_session_timeout` (e.g., 60 seconds)
- Use connection pooling with transaction mode
