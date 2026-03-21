# Universal Error Handling Patterns

## 1. Circuit Breaker
*Prevent cascading failures in distributed systems.*

Detailed Python example in `SKILL.md` provided text, summary logic:
- **States**: CLOSED (Normal), OPEN (Failing), HALF_OPEN (Testing).
- **Logic**: If failures > threshold, flip to OPEN for a timeout period.

## 2. Error Aggregation
*Collect multiple errors instead of failing on first error.*

Common in validation scenarios:
```typescript
class ErrorCollector {
  private errors: Error[] = [];
  add(error: Error) { this.errors.push(error); }
  throw() {
    if (this.errors.length > 0) throw new AggregateError(this.errors);
  }
}
```

## 3. Graceful Degradation
*Provide fallback functionality when errors occur.*

```python
def with_fallback(primary, fallback):
    try:
        return primary()
    except Exception:
        return fallback()
```
