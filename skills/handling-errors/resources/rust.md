# Rust Error Handling Patterns

## Result and Option Types
```rust
use std::fs::File;
use std::io::{self, Read};

// ? operator propagates errors
fn read_file(path: &str) -> Result<String, io::Error> {
    let mut file = File::open(path)?;  
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}
```

## Custom Error Types
```rust
#[derive(Debug)]
enum AppError {
    Io(io::Error),
    Parse(std::num::ParseIntError),
    NotFound(String),
}

impl From<io::Error> for AppError {
    fn from(error: io::Error) -> Self {
        AppError::Io(error)
    }
}
```

## Combinators
```rust
fn get_user_age(id: &str) -> Result<u32, AppError> {
    find_user(id)
        .ok_or_else(|| AppError::NotFound(id.to_string()))
        .map(|user| user.age)
}
```
