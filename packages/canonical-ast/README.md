# @helios/canonical-ast

The Canonical Abstract Syntax Tree (AST) for OpenAPI specifications in HELIOS.
Serves as the universal, version-agnostic intermediate representation neutralizing differences between OpenAPI 2.0 (Swagger), OpenAPI 3.0, and OpenAPI 3.1.

---

## Why a Canonical Intermediate Representation is Needed

OpenAPI 2.0, OpenAPI 3.0, and OpenAPI 3.1 have structural and semantic discrepancies:
- **Parameter & Body representation**: Swagger 2.0 uses `in: body` and `in: formData`, whereas OpenAPI 3.x uses structured `requestBody` with MIME type content maps.
- **JSON Schema dialects**: OpenAPI 3.0 uses an extended subset of JSON Schema draft 00/04/05 with `nullable: true`, whereas OpenAPI 3.1 complies with JSON Schema Draft 2020-12 supporting `type: ["string", "null"]`.
- **Security definitions**: Swagger 2.0 calls them `securityDefinitions`, OpenAPI 3.x nests them under `components.securitySchemes`.
- **Servers vs Host/BasePath**: Swagger 2.0 uses `host`, `basePath`, and `schemes`, whereas 3.x uses parameterized `servers` arrays.

Without a canonical representation, every downstream engine would need dialect-specific branches:
$$O(N_{\text{engines}} \times M_{\text{dialects}})$$

With `@helios/canonical-ast`, parsing and normalization occur once:
$$O(M_{\text{dialects}} \to \text{AST}) + O(N_{\text{engines}} \text{ consuming AST})$$

---

## Architecture & Domain Models

### Core AST Hierarchy
- **`CanonicalApiAst`**: The root specification node containing:
  - `id`: Deterministic stable specification identifier (`${cleanTitle}:${cleanVersion}`)
  - `info`: Title, version, contact, license metadata (`CanonicalInfo`)
  - `servers`: Target hosts and URL templates (`CanonicalServer[]`)
  - `tags`: Specification categorization tags (`CanonicalTag[]`)
  - `endpoints`: Normalized operations (`CanonicalEndpoint[]`)
  - `schemas`: Shared schema models (`Record<string, CanonicalSchema>`)
  - `securitySchemes`: Authentication definitions (`Record<string, CanonicalSecurityScheme>`)
  - `security`: Global security requirements (`CanonicalSecurityRequirement[]`)
  - `metadata`: Normalization timestamp, source format, endpoint/schema counts (`CanonicalMetadata`)

### Operation Models
- **`CanonicalEndpoint`**:
  - `id`: Deterministic identity formatted as `${method}:${normalizedPath}` (e.g., `get:/users/{id}`)
  - `path`: Normalized path (guaranteed leading slash, collapsed consecutive slashes, no trailing slash except root)
  - `method`: Lowercased HTTP verb (`get`, `post`, `put`, `delete`, `patch`, `options`, `head`, `trace`)
  - `parameters`: Deduplicated and deterministically sorted parameters (`CanonicalParameter[]`)
  - `requestBody`: Media type payload mapping (`CanonicalRequestBody`)
  - `responses`: Validated status code map (`Record<string, CanonicalResponse>`)
  - `security`: Operation-level security requirements

### Schema & Property Models
- **`CanonicalSchema`**:
  - Normalized type (`type: string | string[]`)
  - Standardized boolean flags: `nullable`, `readOnly`, `writeOnly`, `deprecated` (strict booleans, never undefined)
  - `requiredProperties`: Deduplicated, alphabetically sorted array of required property names
  - `properties`: Strongly-typed mapping to `CanonicalProperty` (`{ name, schema, required, description }`)
  - `items`: Recursive schema for array items
  - Polymorphic variants: `allOf`, `anyOf`, `oneOf`
  - Cycle detection: `isCircular: boolean` and `rawRef: string` for recursive schemas

---

## Invariant Guarantees

The normalizer enforces structural and semantic invariants before producing a valid AST:
1. **Info Invariants**: `info.title` and `info.version` are strictly required and cannot be empty.
2. **Endpoint Invariants**: Every endpoint must have a non-empty `path` and a valid standard HTTP method.
3. **Endpoint Identity Collisions**: Endpoint IDs (`${method}:${normalizedPath}`) must be globally unique across the specification; duplicate path/method combinations fail with `DUPLICATE_ENDPOINT`.
4. **Parameter Invariants**: Path parameters (`in: "path"`) automatically have `required: true` enforced.
5. **Response Status Codes**: Must be valid 3-digit HTTP status codes (100–599), wildcards (`1XX`–`5XX`), or `"default"`.
6. **Cycle Safety**: In-memory recursive object graphs and self-referential schemas are detected without call-stack exhaustion.

---

## Usage

```typescript
import { buildCanonicalAst, type CanonicalApiAst } from '@helios/canonical-ast';

const rawSpec = {
  openapi: '3.1.0',
  info: { title: 'Users API', version: '1.0.0' },
  paths: {
    '/users/{id}': {
      get: {
        summary: 'Get user by ID',
        parameters: [{ name: 'id', in: 'path' }],
        responses: { '200': { description: 'Success' } },
      },
    },
  },
};

const result = buildCanonicalAst(rawSpec);

if (result.success) {
  const ast: CanonicalApiAst = result.data;
  console.log(`Normalized AST ID: ${ast.id}`);
  console.log(`Endpoints count: ${ast.endpoints.length}`);
  console.log(`Stable endpoint ID: ${ast.endpoints[0].id}`); // "get:/users/{id}"
} else {
  console.error(`Build failed: [${result.error.code}] ${result.error.message}`);
}
```

---

## Backward Compatibility

Existing consumers using Phase 0 contracts (`HeliosSpec`, `HeliosEndpoint`, `HeliosSchema`, etc.) remain 100% compatible via re-exported type aliases:
- `HeliosSpec` $\to$ `CanonicalApiAst`
- `HeliosEndpoint` $\to$ `CanonicalEndpoint`
- `HeliosSchema` $\to$ `CanonicalSchema`
- `HeliosParameter` $\to$ `CanonicalParameter`
- `HeliosRequestBody` $\to$ `CanonicalRequestBody`
- `HeliosResponse` $\to$ `CanonicalResponse`
- `HeliosSecurityScheme` $\to$ `CanonicalSecurityScheme`
- `HeliosSecurityRequirement` $\to$ `CanonicalSecurityRequirement`

---

## Dependencies

- `@helios/shared`: Error hierarchies and source location tracking.
