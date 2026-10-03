# @helios/diff-engine

Deterministic Semantic API Diff and Breaking Change Engine for HELIOS.

The `@helios/diff-engine` performs semantic, AST-level comparisons between two versions of an API represented as `@helios/canonical-ast` (`baseAst` vs. `targetAst`), categorizing contract changes by backward-compatibility impact and identifying security-relevant shifts in API configuration.

---

## Semantic Diff versus Text Diff

Traditional text-based diffing (line-by-line `git diff`) is noisy and brittle for API contracts:
- Reordering YAML/JSON keys produces false diffs.
- Cosmetic formatting changes (spaces vs. tabs, indentation) obscure real structural changes.
- Text diffs cannot discern whether adding a property to a JSON payload is a client-breaking change (e.g. required request property) or backward-compatible (e.g. optional response property).

**HELIOS Semantic Diffing** operates on normalized Canonical ASTs:
- Compares API entities by stable identities (`${method}:${path}`, parameter locations, status codes).
- Evaluates deep object schemas recursively with cycle protection.
- Understands **directionality** (inputs vs. outputs) to determine true compatibility.

---

## Compatibility Classification

Compatibility depends on whether a change affects client input (requests) or server output (responses):

| Change Kind | Context | Impact | Rationale |
| :--- | :--- | :--- | :--- |
| **Endpoint Added** | Global | `non_breaking` | Existing callers continue functioning; new capabilities exposed. |
| **Endpoint Removed** | Global | `breaking` | Existing callers targeting the endpoint will receive 404 Not Found. |
| **Required Parameter Added** | Request | `breaking` | Callers that omit this parameter will fail validation. |
| **Optional Parameter Added** | Request | `non_breaking` | Backward-compatible; clients may supply it at their discretion. |
| **Parameter Removed** | Request | `non_breaking` | Callers can omit; servers typically ignore surplus query/header params. |
| **Parameter Type Changed** | Request | `breaking` | Serialization/type mismatch causes request rejection. |
| **Request Property Made Required**| Request | `breaking` | Existing payloads lacking the field will fail schema validation. |
| **Request Property Removed** | Request | `breaking` | Payloads containing the field may be rejected by strict servers. |
| **Request Enum Value Removed** | Request | `breaking` | Requests with that enum variant are now rejected. |
| **Request Enum Value Added** | Request | `non_breaking` | Server accepts an additional variant without breaking existing ones. |
| **Request Nullable `true -> false`**| Request | `breaking` | Payloads with `null` will now be rejected. |
| **Response Property Removed** | Response | `breaking` | Client deserializers expecting the field will encounter errors. |
| **Optional Response Property Added**| Response | `non_breaking` | Permissive client parsers ignore unknown fields. |
| **Response Type Changed** | Response | `breaking` | Client deserialization crashes on unexpected primitive or object type. |
| **Response Enum Value Added** | Response | `potentially_breaking` | Strict client enums may fail when receiving unexpected variants. |
| **Response Enum Value Removed** | Response | `non_breaking` | Server returns fewer variants; clients still recognize them. |
| **Response Nullable `false -> true`**| Response | `potentially_breaking` | Client parsers may encounter unexpected `null` references. |
| **Security Requirement Added** | Security | `potentially_breaking`* | Unauthenticated callers will now be rejected. Flagged as security-relevant. |
| **Security Requirement Removed** | Security | `non_breaking`* | Protocol continues to work, but endpoint is now public. Flagged as security-relevant. |

*\* All security-altering changes are marked with `isSecurityRelevant: true`.*

---

## Configuration Options

Customize engine sensitivity via `DiffConfiguration`:

```typescript
export interface DiffConfiguration {
  /**
   * Compatibility impact when a property is removed from a response schema.
   * Default: 'breaking'
   */
  responsePropertyRemovalImpact?: 'breaking' | 'potentially_breaking';

  /**
   * Compatibility impact when an enum variant is added to a response schema.
   * Default: 'potentially_breaking'
   */
  responseEnumAdditionImpact?: 'potentially_breaking' | 'non_breaking';

  /**
   * Compatibility impact when an operationId is modified.
   * Default: 'non_breaking'
   */
  operationIdChangeImpact?: 'non_breaking' | 'potentially_breaking';

  /**
   * Compatibility impact when authentication requirement is removed from an endpoint.
   * Default: 'non_breaking'
   */
  unauthenticatedEndpointImpact?: 'non_breaking' | 'potentially_breaking';

  /**
   * Whether to include API metadata changes (title, version, servers, tags).
   * Default: true
   */
  includeMetadataChanges?: boolean;

  /**
   * Whether to perform strict numerical and string bound constraint diffing.
   * Default: true
   */
  strictConstraintChecking?: boolean;

  /**
   * Whether to ignore cosmetic documentation/description changes.
   * Default: true
   */
  ignoreDescriptionChanges?: boolean;
}
```

---

## Usage Example

```typescript
import { diffAsts, DiffEngine } from '@helios/diff-engine';

// Quick one-shot comparison
const result = diffAsts(baseAst, targetAst);

console.log(`Total Changes: ${result.summary.totalChanges}`);
console.log(`Has Breaking Changes: ${result.hasBreakingChanges}`);
console.log(`Breaking: ${result.summary.breaking}`);
console.log(`Security-Relevant Changes: ${result.summary.securityRelevant}`);

// Iterate through structured changes
for (const change of result.changes) {
  console.log(`[${change.compatibility.toUpperCase()}] ${change.kind}: ${change.message}`);
  if (change.isSecurityRelevant) {
    console.log(`  -> Security Notice: ${change.rationale}`);
  }
}
```

---

## Limitations of Static Contract Comparison

- **Dynamic Behaviors**: Static AST diffing cannot verify business logic changes, database migrations, or semantic behavioral mutations that preserve method signatures and schema types.
- **Client Lenience**: Whether response property addition or removal breaks a client depends on the client's JSON deserializer settings (e.g. strict vs. tolerant readers).
- **Runtime Validation**: OpenAPI specifications indicate intended schema boundaries, but runtime gateways or code frameworks might enforce different runtime rules.
