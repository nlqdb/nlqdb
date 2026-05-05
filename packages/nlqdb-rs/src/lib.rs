//! # nlqdb
//!
//! Rust client for nlqdb — natural-language databases.
//!
//! This is a placeholder. Real implementation coming in Phase 2.
//!
//! ```rust
//! // TODO: example usage
//! ```

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn hello() -> &'static str {
    "nlqdb — natural-language databases"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        assert_eq!(hello(), "nlqdb — natural-language databases");
    }
}
