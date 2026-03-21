# Python Error Handling Patterns

## Custom Exception Hierarchy
```python
class ApplicationError(Exception):
    """Base exception for all application errors."""
    def __init__(self, message: str, code: str = None, details: dict = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}
        self.timestamp = datetime.utcnow()

class ValidationError(ApplicationError):
    """Raised when validation fails."""
    pass

class NotFoundError(ApplicationError):
    """Raised when resource not found."""
    pass
```

## Context Managers for Cleanup
```python
from contextlib import contextmanager

@contextmanager
def database_transaction(session):
    """Ensure transaction is committed or rolled back."""
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()
```

## Retry with Exponential Backoff
```python
def retry(max_attempts: int = 3, backoff_factor: float = 2.0, exceptions: tuple = (Exception,)):
    """Retry decorator with exponential backoff."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # ... implementation ...
            pass
        return wrapper
    return decorator
```
