# Concurrency & Locking Rules (MEDIUM-HIGH)

## Rule: lock-row-level-locking

### Why It Matters
Table-level locks block all concurrent access. Use row-level locks when possible.

### Incorrect Example
```sql
-- Locks entire table
LOCK TABLE accounts IN EXCLUSIVE MODE;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
```

### Correct Example
```sql
-- Locks only specific row
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- Or use SELECT FOR UPDATE for explicit row locking
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
```

---

## Rule: lock-deadlock-prevention

### Why It Matters
Deadlocks occur when transactions wait for each other's locks. Always acquire locks in consistent order.

### Incorrect Example
```sql
-- Transaction 1
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

-- Transaction 2 (runs concurrently)
BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2; -- Waits for T1
UPDATE accounts SET balance = balance + 50 WHERE id = 1; -- DEADLOCK!
COMMIT;
```

### Correct Example
```sql
-- Both transactions lock in same order (by id)
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

**Best Practice:** Always lock rows in ascending ID order.

---

## Rule: lock-optimistic-locking

### Why It Matters
Optimistic locking prevents lost updates without holding locks.

### Implementation
```sql
-- Add version column
ALTER TABLE documents ADD COLUMN version int DEFAULT 1;

-- Update with version check
UPDATE documents 
SET content = 'new content', version = version + 1
WHERE id = 123 AND version = 5;

-- Check affected rows (0 = conflict)
```

**Use Case:** Collaborative editing, long-running user interactions.
