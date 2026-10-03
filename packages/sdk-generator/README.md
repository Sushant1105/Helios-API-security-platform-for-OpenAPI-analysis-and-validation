# @helios/sdk-generator

Deterministic, polyglot client SDK generator for HELIOS Canonical ASTs.

The `@helios/sdk-generator` package transforms normalized `CanonicalApiAst` specifications into idiomatic, fully-typed, production-grade client SDK packages for **TypeScript** and **Python**.

---

## Supported Languages

| Language Target | Environment / Runtime | Key Features |
| :--- | :--- | :--- |
| **`typescript`** | Node.js (ESM), Web Browsers, Deno, Bun | Modern `fetch`-based client, strict TypeScript types/interfaces, typed errors, `package.json`, `tsconfig.json`, `README.md`. |
| **`python`** | Python 3.10+ | Zero third-party dependencies, standard library `@dataclass`, `urllib.request`, `typing`, `enum.Enum`, `pyproject.toml` (PEP 621), `README.md`. |

---

## Architecture & Extensibility

The generator is built with a pluggable architecture:
- `SdkGenerator`: Core dispatcher orchestrating options validation, language generators, and deterministic file sorting.
- `LanguageGenerator`: Pluggable interface (`generate(ast, options): GeneratedSdk`) allowing future targets (e.g. Go, Java, C#, Rust) to be added without modifying existing generators.
- `generateSdk(ast, options)`: Convenient functional wrapper for one-shot generation.

---

## Generator Usage

```typescript
import { generateSdk } from '@helios/sdk-generator';

// 1. Generate TypeScript Client SDK
const tsSdk = generateSdk(canonicalAst, {
  target: 'typescript',
  packageName: '@myorg/petstore-client',
  packageVersion: '1.0.0',
  baseUrl: 'https://api.petstore.com/v1',
});

// 2. Generate Python Client SDK
const pySdk = generateSdk(canonicalAst, {
  target: 'python',
  packageName: 'petstore_client',
  packageVersion: '1.0.0',
  baseUrl: 'https://api.petstore.com/v1',
});

// Inspect generated files
for (const file of tsSdk.files) {
  console.log(`File: ${file.path} (${file.content.length} bytes)`);
}
```

---

## Configuration Options

```typescript
export interface GeneratorOptions {
  /** Target language: 'typescript' or 'python' */
  target: 'typescript' | 'python';

  /** Package name (e.g. '@company/api-client' or 'company_api') */
  packageName: string;

  /** Package semantic version (default: '1.0.0') */
  packageVersion?: string;

  /** Human-readable package description */
  packageDescription?: string;

  /** Default base URL (defaults to first server in AST or 'https://api.example.com') */
  baseUrl?: string;

  /** Author information for package metadata */
  author?: string;

  /** License string (default: 'Apache-2.0') */
  license?: string;

  /** Whether to emit docstrings and comments (default: true) */
  includeDocumentation?: boolean;

  /** Name of the main client class (default: 'ApiClient') */
  clientClassName?: string;
}
```

---

## Generated Project Structure

### TypeScript
```
@packageName/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts        # Unified public exports
    ├── client.ts       # ApiClient class with endpoint methods & fetch logic
    ├── types.ts        # Typed models, enums, params, and request/response shapes
    └── errors.ts       # ApiException, ApiHttpError, ApiValidationError
```

### Python
```
package_name/
├── pyproject.toml      # Standard PEP 621 build configuration
├── README.md
└── package_name/
    ├── __init__.py     # Module exports
    ├── client.py       # ApiClient class with methods & urllib dispatch
    ├── models.py       # Dataclasses, enums, and typing annotations
    └── errors.py       # Exception hierarchy
```

---

## Supported OpenAPI Constructs

- **HTTP Verbs:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.
- **Parameters:** Path interpolation (`{id}`), URL search query parameters, custom HTTP headers.
- **Payloads:** JSON request bodies serialized cleanly; `application/json` response deserialization.
- **Data Types:** `string`, `integer`, `number`, `boolean`, `array`, `object`, `enum`, `nullable`, `oneOf`.
- **Authentication:** Configurable client options for API keys, Bearer tokens, HTTP Basic, and OAuth2 tokens.

---

## Unsupported / Deferred Constructs

- Multipart/form-data streaming and chunked file uploads (basic binary payloads supported).
- Server-sent events (SSE) and WebSocket streams.
- Deep inheritance hierarchies with `discriminator` mapping beyond standard union typing.
- Java, Go, C#, Kotlin, Swift (deferred to subsequent releases).

---

## Determinism & Security Guarantees

1. **Deterministic Output:**
   - Files are sorted alphabetically by path.
   - Models and properties are sorted deterministically.
   - Zero timestamps or random UUIDs are inserted into generated files.
   - The same AST and options always produce identical output byte-for-byte.

2. **Security Considerations:**
   - **Zero Hardcoded Secrets:** Credentials (API keys, tokens, passwords) are never hardcoded into generated SDK code. They are always passed as runtime configuration options to client constructors.
   - **Identifier Sanitization:** Reserved keywords in TypeScript and Python are safely escaped to prevent syntax injection.
   - **URL Encoding:** All path and query parameter substitutions are properly URL-encoded.
