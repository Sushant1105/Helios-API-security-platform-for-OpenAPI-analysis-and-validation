# @helios/shared

Shared primitives, error models, result types, and universal contracts used across the entire HELIOS monorepo.

## Future Responsibilities

- Provide universal functional error handling (`Result<T, E>`).
- Define common finding severity tiers (`INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- Provide source-mapping coordinates (`SourceLocation`) linking AST nodes and diagnostic findings back to exact lines in OpenAPI source files.
- Expose base application error classes (`HeliosError`) with machine-readable error codes.

## Dependencies

- None (pure zero-dependency TypeScript).
