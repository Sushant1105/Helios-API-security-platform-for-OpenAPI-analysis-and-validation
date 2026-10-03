# @helios/compliance-engine

Deterministic compliance control mapping and transparent risk score calculation for HELIOS.

## Regulatory & Legal Disclaimer

> [!IMPORTANT]
> **Automated Checks Only:** HELIOS does NOT certify or warrant formal compliance with PCI-DSS, HIPAA, or statutory legal standards. This engine provides automated static mappings between detectable API specification properties/findings and relevant regulatory technical control categories.

## Future Responsibilities

- Map security findings to:
  - OWASP API Security Top 10 (2023)
  - PCI-DSS v4.0 Technical Controls (API-relevant sections: requirement 6, 8, etc.)
  - HIPAA Security Rule Technical Safeguards (45 CFR § 164.312)
- Calculate a fully transparent, formulaic risk score ($0 - 100$) where weights and penalties are clearly documented and inspectable.

## Dependencies

- `@helios/canonical-ast`
- `@helios/security-engine`
- `@helios/shared`
