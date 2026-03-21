---
name: handling-errors
description: Master error handling patterns across languages including exceptions, Result types, error propagation, and graceful degradation. Use when debugging production issues, implementing error handling in new features, or improving application reliability.
---

# Error Handling Patterns & Troubleshooting

## When to use this skill
- Implementing error handling in new features or APIs.
- Debugging and fixing production issues.
- Improving application reliability and fault tolerance.
- Refactoring code to have better error messages and resilience.

## Workflow
1.  **Analyze the Context**: Determine the language, runtime environment, and type of application.
2.  **Categorize the Error**: Is it recoverable (network, input) or unrecoverable (OOM, bug)?
3.  **Select the Pattern**: Consult the language-specific resources below.
4.  **Implement & Verify**: Apply the pattern and write a test case to simulate the failure.

## Philosophy & Core Concepts
- **Exceptions vs Result Types**:
    - *Exceptions*: Use for unexpected errors or exceptional conditions.
    - *Result Types*: Use for expected errors and validation failures (functional approach).
- **Fail Fast**: Validate input early, fail quickly.
- **Preserve Context**: Include stack traces, metadata, and timestamps.
- **Clean Up**: Always use try-finally or context managers.

## Language-Specific Guidelines
Depending on your stack, refer to these detailed guides:

- **Python**: [resources/python.md](resources/python.md) (Custom exceptions, Context managers, Retries)
- **TypeScript/JS**: [resources/typescript.md](resources/typescript.md) (Custom classes, Result types, Async handling)
- **Rust**: [resources/rust.md](resources/rust.md) (Result/Option types, Custom enums)
- **Go**: [resources/go.md](resources/go.md) (Explicit error returns, Sentinel errors, Wrapping)

## Universal Architecture Patterns
For distributed systems or complex logic, use these patterns:
- **Circuit Breaker**: Prevent cascading failures.
- **Error Aggregation**: Collect multiple errors (e.g., validation) before failing.
- **Graceful Degradation**: Fallbacks when primary methods fail.

👉 **[See resources/universal-patterns.md](resources/universal-patterns.md)** for implementation details.

## Best Practices Checklist
- [ ] **Fail Fast**: Validate input early.
- [ ] **Context**: Logs include stack traces and metadata.
- [ ] **User-Facing**: detailed internal logs != user error messages.
- [ ] **Cleanup**: Resources (files, connections) are released in `finally` blocks.
- [ ] **Type Safety**: Use typed errors where possible.
