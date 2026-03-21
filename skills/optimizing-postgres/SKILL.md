---
name: optimizing-postgres
description: Postgres performance optimization and best practices from Supabase. Use when writing, reviewing, or optimizing Postgres queries, schema designs, or database configurations.
---

# Supabase Postgres Best Practices

Comprehensive performance optimization guide for Postgres, maintained by Supabase. Contains rules across 8 categories, prioritized by impact to guide automated query optimization and schema design.

## When to use this skill
- Writing SQL queries or designing schemas
- Implementing indexes or query optimization
- Reviewing database performance issues
- Configuring connection pooling or scaling
- Optimizing for Postgres-specific features
- Working with Row-Level Security (RLS)

## Workflow

1. **Identify the Performance Issue**
   - Slow queries?
   - Connection pool exhaustion?
   - Lock contention?
   - Security concerns?

2. **Consult the Relevant Category**
   - See [Rule Categories](#rule-categories-by-priority) below
   - Navigate to the appropriate resource file

3. **Apply the Rule**
   - Review incorrect vs correct examples
   - Analyze EXPLAIN output if provided
   - Implement the recommended pattern

4. **Verify Improvement**
   - Run EXPLAIN ANALYZE before and after
   - Monitor query performance metrics
   - Check connection pool utilization

## Rule Categories by Priority

| Priority | Category | Impact | Prefix | Resource File |
|----------|----------|--------|--------|---------------|
| 1 | Query Performance | CRITICAL | `query-` | [resources/query-performance.md](resources/query-performance.md) |
| 2 | Connection Management | CRITICAL | `conn-` | [resources/connection-management.md](resources/connection-management.md) |
| 3 | Security & RLS | CRITICAL | `security-` | [resources/security-rls.md](resources/security-rls.md) |
| 4 | Schema Design | HIGH | `schema-` | [resources/schema-design.md](resources/schema-design.md) |
| 5 | Concurrency & Locking | MEDIUM-HIGH | `lock-` | [resources/concurrency-locking.md](resources/concurrency-locking.md) |
| 6 | Data Access Patterns | MEDIUM | `data-` | [resources/data-access.md](resources/data-access.md) |
| 7 | Monitoring & Diagnostics | LOW-MEDIUM | `monitor-` | [resources/monitoring.md](resources/monitoring.md) |
| 8 | Advanced Features | LOW | `advanced-` | [resources/advanced-features.md](resources/advanced-features.md) |

## Instructions

### Reading Rule Files
Each resource file contains multiple rules with:
- **Brief explanation** of why it matters
- **Incorrect SQL example** with explanation
- **Correct SQL example** with explanation
- **EXPLAIN output** or metrics (when applicable)
- **Additional context** and references
- **Supabase-specific notes** (when applicable)

### Common Optimization Patterns

**Missing Indexes:**
```sql
-- Bad: Full table scan
SELECT * FROM users WHERE email = 'user@example.com';

-- Good: Index scan
CREATE INDEX idx_users_email ON users(email);
SELECT * FROM users WHERE email = 'user@example.com';
```

**Connection Pooling:**
Use connection pooling (pgBouncer) for serverless/high-concurrency workloads.

**Row-Level Security:**
Optimize RLS policies to avoid sequential scans on large tables.

## Resources
- [resources/query-performance.md](resources/query-performance.md) - Critical query optimization rules
- [resources/connection-management.md](resources/connection-management.md) - Connection pooling and scaling
- [resources/security-rls.md](resources/security-rls.md) - RLS optimization and security
- [resources/schema-design.md](resources/schema-design.md) - Schema design best practices
- [resources/concurrency-locking.md](resources/concurrency-locking.md) - Lock management
- [resources/data-access.md](resources/data-access.md) - Data access patterns
- [resources/monitoring.md](resources/monitoring.md) - Performance monitoring
- [resources/advanced-features.md](resources/advanced-features.md) - Advanced Postgres features

## External References
- https://www.postgresql.org/docs/current/
- https://supabase.com/docs
- https://wiki.postgresql.org/wiki/Performance_Optimization
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/auth/row-level-security
