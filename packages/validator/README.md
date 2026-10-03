# @helios/validator

Deterministic structural, semantic, reference, and invariant validation engine for OpenAPI specifications and Canonical AST models in the HELIOS developer platform.

---

## Validation vs. Security Auditing

A foundational principle of HELIOS is the strict boundary between **Specification Validation** and **Security Auditing**:

| Responsibility Area | Specification Validator (`@helios/validator`) | Security Engine (`@helios/security-engine` — Phase 4) |
| :--- | :--- | :--- |
| **Objective** | Ensure structural correctness, semantic coherence, reference integrity, and AST invariants. | Detect security vulnerabilities, authorization gaps, data exposures, and policy weaknesses. |
| **Examples of Checks** | Missing `info.title`, undeclared path parameters, broken `$ref` schema pointers, duplicate `operationId`s, invalid HTTP 204 response body content. | Missing authentication, weak JWT algorithms, broken object level authorization (BOLA), sensitive PII leakage, lack of rate limiting. |
| **Standard References** | OpenAPI 2.0/3.0/3.1 Specifications, RFC 9110 (HTTP Semantics), RFC 6901 (JSON Pointers). | OWASP API Security Top 10, PCI-DSS, HIPAA security safeguards. |
| **Execution Point** | Runs immediately after spec parsing to sanitize the Canonical AST. | Consumes a validated Canonical AST to perform deterministic audits. |

---

## Finding Model

Every finding produced by `@helios/validator` is strongly typed and 100% deterministic:

```typescript
export interface ValidationFinding {
  readonly id: string; // Deterministic ID: "${category}:${code}:${target}:${subKey}"
  readonly severity: ValidationSeverity; // 'error' | 'warning' | 'info'
  readonly category: ValidationCategory; // 'structure' | 'semantic' | 'reference' | 'consistency' | 'compatibility'
  readonly code: ValidationCode; // Stable machine-readable diagnostic code
  readonly message: string; // Human-readable explanation
  readonly path?: string; // Target path or schema pointer
  readonly endpointId?: string; // Stable endpoint identity (e.g., "get:/users/{id}")
  readonly suggestion?: string; // Actionable remediation advice
  readonly location?: SourceLocation; // Raw file line/column coordinates
}
```

### Severity Tiers
- **`error`**: Critical structural, semantic, or reference violations that prevent reliable downstream consumption. Renders `isValid === false`.
- **`warning`**: Non-blocking specification anomalies or code smells (e.g., missing response descriptions, empty request body content maps, orphan path parameters).
- **`info`**: Informational diagnostics (e.g., notification that a schema contains recursive/circular references).

### Finding Categories
- **`structure`**: Missing API title or version, malformed path strings, unclosed braces, invalid HTTP methods, endpoints missing responses, non-standard response status codes.
- **`semantic`**: Undeclared path parameters, path parameters marked `required: false`, duplicate `operationId`s, duplicate endpoint identities, required schema properties missing from `properties`, invalid response body combinations (e.g. 204/304 with content).
- **`reference`**: Broken local schema references (`#/components/schemas/{name}`), operation or global security requirements referencing undefined security schemes.
- **`consistency`**: Contradictory schema composition (e.g. `allOf` combining contradictory primitive types like `string` and `number`), AST invariant violations.
- **`compatibility`**: Specification version inconsistencies and dialect incompatibilities.

---

## Determinism Guarantees

1. **No Random Identifiers**: Finding IDs use deterministic composite keys: `${category}:${code}:${target}:${subKey}`.
2. **Stable Order**: Findings are sorted deterministically:
   - Primary: Severity rank (`error` $\to$ `warning` $\to$ `info`)
   - Secondary: Category alphabetically
   - Tertiary: Endpoint ID or target path alphabetically
   - Quaternary: Diagnostic code alphabetically
   - Quinary: Finding ID alphabetically
3. **Idempotence**: Multiple runs against the same specification or AST will produce bit-exact identical output regardless of object key insertion order.

---

## How Downstream Engines Consume Validator Output

Downstream engines (`@helios/security-engine`, `@helios/compliance-engine`, `@helios/diff-engine`, `@helios/sdk-generator`, `@helios/ai-engine`) consume validator output to establish preconditions:

```
Raw Specification (YAML / JSON)
              │
              ▼
    @helios/spec-parser
              │
              ▼
   @helios/canonical-ast
              │
              ▼
     @helios/validator ──▶ [If !isValid] ──▶ Reject invalid AST
              │
      [If isValid: true]
              │
              ├───────────────────────────────┬───────────────────────────────┐
              ▼                               ▼                               ▼
  @helios/security-engine        @helios/compliance-engine        @helios/diff-engine
 (OWASP API Top 10 Audits)     (Risk Scoring & Frameworks)       (Semantic Version Diff)
```

1. **Security & Compliance Engines**: Ensure every analyzed endpoint possesses valid paths, parameters, responses, and security schemes before evaluating security rules.
2. **Semantic Diff Engine**: Guarantees that endpoint identity collisions and malformed schemas do not cause false breaking change flags.
3. **AI Copilot & Ground-Truth Validator**: Uses clean validator findings to prevent hallucinated references from being presented as valid API entities.

---

## Usage Examples

### Validating a Canonical AST
```typescript
import { buildCanonicalAst } from '@helios/canonical-ast';
import { validateAst, type ValidationResult } from '@helios/validator';

const buildResult = buildCanonicalAst(rawSpec);
if (buildResult.success) {
  const result: ValidationResult = validateAst(buildResult.data);

  if (result.isValid) {
    console.log('Specification is structurally and semantically valid.');
  } else {
    console.error(`Validation failed with ${result.stats.errorCount} errors:`);
    for (const finding of result.findings) {
      console.error(`[${finding.severity.toUpperCase()}] (${finding.code}) ${finding.message}`);
      if (finding.suggestion) {
        console.log(`  -> Suggestion: ${finding.suggestion}`);
      }
    }
  }
}
```

### Direct Spec Validation
```typescript
import { validateSpec } from '@helios/validator';

const result = validateSpec(rawSpecObject);
console.log(`Valid: ${result.isValid}, Total Findings: ${result.stats.totalCount}`);
```

---

## Dependencies

- `@helios/canonical-ast`: Canonical AST models, normalization helpers, and HTTP constants.
- `@helios/shared`: Source location coordinates and error types.
