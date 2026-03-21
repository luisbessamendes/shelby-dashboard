# TypeScript/JavaScript Error Handling Patterns

## Custom Error Classes
```typescript
class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

## Result Type Pattern
```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function Ok<T>(value: T): Result<T, never> { return { ok: true, value }; }
function Err<E>(error: E): Result<never, E> { return { ok: false, error }; }

function parseJSON<T>(json: string): Result<T, SyntaxError> {
  try {
    return Ok(JSON.parse(json) as T);
  } catch (error) {
    return Err(error as SyntaxError);
  }
}
```

## Async Error Handling
```typescript
async function fetchUserOrders(userId: string): Promise<Order[]> {
  try {
    const user = await getUser(userId);
    return await getOrders(user.id);
  } catch (error) {
    if (error instanceof NotFoundError) return [];
    if (error instanceof NetworkError) return retryFetchOrders(userId);
    throw error;
  }
}
```
