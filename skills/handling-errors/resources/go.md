# Go Error Handling Patterns

## Explicit Error Returns
```go
func getUser(id string) (*User, error) {
    user, err := db.QueryUser(id)
    if err != nil {
        return nil, fmt.Errorf("failed to query user: %w", err)
    }
    if user == nil {
        return nil, errors.New("user not found")
    }
    return user, nil
}
```

## Custom Error Types
```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed for %s: %s", e.Field, e.Message)
}
```

## Error Checking & Wrapping
```go
// Sentinel errors
if errors.Is(err, ErrNotFound) { ... }

// Type assertion
var valErr *ValidationError
if errors.As(err, &valErr) { ... }
```
