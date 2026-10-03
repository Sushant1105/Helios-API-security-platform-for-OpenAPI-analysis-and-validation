# @helios/security-engine

Rule-based, deterministic API security analysis engine for the HELIOS platform.
Analyzes the Canonical AST for authentication vulnerabilities, transport security weaknesses, sensitive data exposures, and resource consumption defects.

---

## Architectural Principles & Scope Boundaries

1. **Zero AI / Deterministic Execution**:
   This engine contains **no LLMs, no Ollama integration, no embeddings, no vector databases, and no external AI services**. Every check is a pure, reproducible TypeScript rule executing directly on Canonical AST structures.
2. **Static Analysis vs. Runtime Testing**:
   Static analysis inspects API interface definitions, parameter specifications, schema constraints, and server transport declarations. It **does not execute live HTTP traffic, perform penetration testing, or verify runtime authorization logic**. An endpoint flagged with authentication requirements statically may still fail at runtime if the backend implementation is flawed.
3. **OWASP API Security Top 10 Mapping**:
   Each rule is mapped to a relevant category from the OWASP API Security Top 10 (2023 edition). These mappings indicate **technical architectural relevance** and do not constitute legal proof of vulnerability or statutory compliance.

---

## Rule Catalog

### 1. Authentication & Authorization Rules (`authRules`)

| Rule ID | Rule Name | Default Severity | Confidence | OWASP Category | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AUTH-001` | `MISSING_EFFECTIVE_SECURITY` | `HIGH` | `HIGH` | `API2:2023_BROKEN_AUTH` | Endpoint defines no operation-level security requirement and no global security exists. |
| `AUTH-002` | `EXPLICIT_PUBLIC_ENDPOINT` | `MEDIUM` | `HIGH` | `API2:2023_BROKEN_AUTH` | Endpoint explicitly overrides global security with an empty array `security: []`. |
| `AUTH-003` | `UNUSED_SECURITY_SCHEME` | `INFO` | `HIGH` | `API9:2023_IMPROPER_INVENTORY_MANAGEMENT` | Security scheme is declared in `components.securitySchemes` but never referenced. |
| `AUTH-004` | `INSECURE_BASIC_AUTH` | `HIGH` | `HIGH` | `API2:2023_BROKEN_AUTH` | HTTP Basic authentication configured while the API exposes unencrypted HTTP servers. |
| `AUTH-005` | `INCOMPLETE_OAUTH2_CONFIG` | `MEDIUM` | `HIGH` | `API2:2023_BROKEN_AUTH` | OAuth2 or OpenID Connect scheme lacks required flow endpoints (token/auth URLs). |
| `AUTH-006` | `UNDEFINED_SECURITY_SCHEME` | `HIGH` | `HIGH` | `API8:2023_SECURITY_MISCONFIGURATION` | Endpoint or global security references an undefined authentication scheme. |

### 2. Transport Security Rules (`transportRules`)

| Rule ID | Rule Name | Default Severity | Confidence | OWASP Category | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TRNS-001` | `HTTP_SERVER_URL` | `HIGH` | `HIGH` | `API8:2023_SECURITY_MISCONFIGURATION` | Server URL specifies unencrypted `http://` transport (excluding localhost). |
| `TRNS-002` | `INSECURE_PRODUCTION_SERVER` | `CRITICAL` | `HIGH` | `API8:2023_SECURITY_MISCONFIGURATION` | Production server URL configured with unencrypted `http://`. |
| `TRNS-003` | `SENSITIVE_OPERATION_OVER_HTTP` | `HIGH` | `HIGH` | `API2:2023_BROKEN_AUTH` | State-modifying (`POST`/`PUT`/`PATCH`/`DELETE`) or auth endpoint on HTTP-only servers. |
| `TRNS-004` | `QUERY_API_KEY_AUTH` | `MEDIUM` | `HIGH` | `API2:2023_BROKEN_AUTH` | API Key authentication configured with `in: 'query'`, leaking credentials into logs and URLs. |

### 3. Sensitive Data Exposure Rules (`dataExposureRules`)

| Rule ID | Rule Name | Default Severity | Confidence | OWASP Category | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DATA-001` | `SENSITIVE_FIELD_IN_RESPONSE` | `HIGH` | `MEDIUM` | `API3:2023_BOPLA` | Response schema contains properties matching sensitive credential, token, or PII keywords. |
| `DATA-002` | `SENSITIVE_FIELD_IN_REQUEST` | `MEDIUM` | `MEDIUM` | `API3:2023_BOPLA` | Sensitive credentials or PII transmitted via URL query or path parameters. |

### 4. Resource Consumption Rules (`resourceRules`)

| Rule ID | Rule Name | Default Severity | Confidence | OWASP Category | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `RSRC-001` | `UNPAGINATED_COLLECTION` | `MEDIUM` | `MEDIUM` | `API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION` | Collection endpoint returning array lacks pagination query parameters (`limit`, `offset`, `page`, etc.). |
| `RSRC-002` | `ARRAY_WITHOUT_MAX_ITEMS` | `LOW` | `MEDIUM` | `API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION` | Request array schema lacks `maxItems` constraint. |
| `RSRC-003` | `STRING_WITHOUT_MAX_LENGTH` | `LOW` | `LOW` | `API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION` | Free-form string property in request body lacks `maxLength`. |
| `RSRC-004` | `NUMERIC_WITHOUT_BOUNDS` | `LOW` | `LOW` | `API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION` | Numeric parameter or body property lacks `minimum` or `maximum` limits. |
| `RSRC-005` | `UNCONSTRAINED_FILE_UPLOAD` | `MEDIUM` | `MEDIUM` | `API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION` | Binary or multipart file upload lacks documented payload size limits. |

---

## Severity vs. Confidence Tiers

The engine decouples **Severity** from **Confidence**:

### Severity Levels
- **`CRITICAL`**: Critical exposure, such as production servers over unencrypted HTTP.
- **`HIGH`**: Severe authentication gaps, plaintext Basic Auth, unencrypted state-modifying verbs, or credentials exposed in response schemas.
- **`MEDIUM`**: Intentionally public overrides, unpaginated collections, or API keys in query parameters.
- **`LOW`**: Unbounded strings, missing array `maxItems`, or numeric inputs without bounds.
- **`INFO`**: Unused security schemes or configuration notices.

### Confidence Levels
- **`HIGH`**: Definitive static structural facts (e.g. `http://` prefix in URL, missing security array).
- **`MEDIUM`**: Context-dependent findings (e.g. unpaginated collections, sensitive field name heuristics).
- **`LOW`**: Broad hygiene indicators (e.g. unconstrained string lengths without format hints).

---

## Transparent Risk Score Calculation

The security posture score is calculated on a 0–100 scale using a transparent deduction formula:

$$\text{Score} = \max\left(0, \min\left(100, 100 - \sum \text{Deductions}\right)\right)$$

* **Critical Finding**: $-25$ points
* **High Finding**: $-15$ points
* **Medium Finding**: $-7$ points
* **Low Finding**: $-2$ points
* **Info Finding**: $-0$ points

---

## Usage Example

```typescript
import { buildCanonicalAst } from '@helios/canonical-ast';
import { runSecurityAudit, SecurityEngine } from '@helios/security-engine';

const buildRes = buildCanonicalAst(rawSpec);
if (buildRes.success) {
  const audit = runSecurityAudit(buildRes.data, {
    sensitiveFieldNames: ['ssn', 'passcode', 'tax_id'],
  });

  console.log(`Security Score: ${audit.score}/100`);
  console.log(`Total Findings: ${audit.summary.total}`);

  for (const finding of audit.findings) {
    console.log(`[${finding.severity}] (${finding.ruleId}) ${finding.title}`);
    console.log(`  Remediation: ${finding.remediation}`);
  }
}
```

---

## Dependencies

- `@helios/canonical-ast`: Intermediate AST models and schema definitions.
- `@helios/shared`: Severity tiers and source coordinates.
