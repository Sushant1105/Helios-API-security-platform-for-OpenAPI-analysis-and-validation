# @helios/spec-parser

Production-oriented OpenAPI 3.0 and 3.1 specification parser, dialect detector, local reference dereferencer, and Canonical AST normalizer for the HELIOS platform.

---

## Capabilities

- **Multi-Format Support:** Ingests raw JSON or YAML strings as well as local files (`parseSpecFile`).
- **OpenAPI 3.0 & 3.1 Compliant:** Normalizes endpoints, schemas, parameters, request bodies, responses, servers, tags, and security requirements.
- **Strict Structural Validation:** Enforces the mandatory presence and format of root `openapi`, `info` (`title`, `version`), and `paths`.
- **Structured Error Handling:** Returns discriminated `Result` types with explicit error codes (`SYNTAX_ERROR`, `UNSUPPORTED_VERSION`, `VALIDATION_ERROR`, `REFERENCE_RESOLUTION_ERROR`, `FILE_READ_ERROR`).
- **Safe Local `$ref` Dereferencing:** Resolves internal JSON Pointers (`#/components/schemas/...`, `#/components/parameters/...`) with RFC 6901 token decoding (`~1` $\to$ `/`, `~0` $\to$ `~`).
- **Cycle-Resistant:** Detects circular schema graphs and breaks recursion cleanly by tagging nodes with `isCircular: true`.
- **SSRF & Network Guard:** Rejects unsafe external HTTP/HTTPS and arbitrary remote references by design.
- **Canonical AST Bridge:** Provides `toCanonicalAst(parsed)` to transform normalized specs directly into `@helios/canonical-ast`'s `HeliosSpec`.

---

## Installation

Within the HELIOS monorepo:

```json
{
  "dependencies": {
    "@helios/spec-parser": "workspace:*"
  }
}
```

---

## Usage Examples

### 1. Parsing a YAML or JSON Specification

```typescript
import { parseSpec } from '@helios/spec-parser';

const yamlContent = `
openapi: 3.1.0
info:
  title: Users Service
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      responses:
        '200':
          description: OK
`;

const result = await parseSpec(yamlContent);

if (result.success) {
  console.log(`Parsed ${result.data.info.title} v${result.data.info.version}`);
  console.log(`Total Endpoints: ${result.data.metadata.totalEndpoints}`);
} else {
  console.error(`Parser error [${result.error.code}]: ${result.error.message}`);
}
```

### 2. Reading Directly from a File

```typescript
import { parseSpecFile } from '@helios/spec-parser';

const result = await parseSpecFile('./specs/petstore.yaml');
if (result.success) {
  for (const endpoint of result.data.endpoints) {
    console.log(`${endpoint.method.toUpperCase()} ${endpoint.path} -> ${endpoint.summary}`);
  }
}
```

### 3. Converting to Canonical AST

```typescript
import { parseSpecSync, toCanonicalAst } from '@helios/spec-parser';
import type { HeliosSpec } from '@helios/canonical-ast';

const result = parseSpecSync(rawSpecContent);
if (result.success) {
  const canonicalAst: HeliosSpec = toCanonicalAst(result.data);
  // Pass canonicalAst to downstream security, compliance, or diff engines
}
```

---

## Error Handling

All errors return structured `ParserError` objects:

| Error Code | Description |
| :--- | :--- |
| `SYNTAX_ERROR` | Malformed JSON or YAML content. |
| `UNSUPPORTED_VERSION` | Non-3.x specifications (e.g. Swagger 2.0 or future versions). |
| `VALIDATION_ERROR` | Missing root properties (`openapi`, `info.title`, `info.version`, or `paths`). |
| `REFERENCE_RESOLUTION_ERROR` | Unresolvable local `$ref` pointer, missing pointer target, or external URL attempt. |
| `FILE_READ_ERROR` | Filesystem I/O error when reading from path. |
