# @helios/test-suite

Comprehensive testing corpus, benchmark harnesses, and offline AI verification suites for HELIOS.

## Future Responsibilities

- Curate a library of standard OpenAPI 2.0, 3.0, and 3.1 specifications (including large real-world specs like Stripe, GitHub, Petstore, Kubernetes).
- Supply edge-case fixtures: cyclic schema references, malformed YAML, unicode endpoint paths, deeply nested polymorphism (`allOf`/`oneOf`).
- Provide benchmark measurements: parse speed (MB/s), AST memory footprint, security rule execution throughput.
- Host an **offline AI verification suite** that tests LLM explanations against known specifications without requiring live network calls, validating output against ground-truth AST nodes and asserting zero hallucinations.

## Dependencies

- `@helios/canonical-ast`
- `@helios/security-engine`
- `@helios/shared`
- `@helios/spec-parser`
