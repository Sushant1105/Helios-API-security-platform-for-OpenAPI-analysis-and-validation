/**
 * @helios/validator
 * Core Validation Engine executing structural, semantic, and invariant rules.
 * Enforces 100% deterministic finding ordering, reproducible identifiers, and statistics computation.
 */

import type { CanonicalApiAst } from '@helios/canonical-ast';
import type {
  ValidationFinding,
  ValidationOptions,
  ValidationResult,
  ValidationSeverity,
  ValidationStats,
} from './types.js';
import { StructuralValidator } from './rules/structural.js';
import { SemanticValidator } from './rules/semantic.js';
import { InvariantValidator } from './rules/invariant.js';

const SEVERITY_ORDER: Record<ValidationSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export class ValidatorEngine {
  /**
   * Validates a CanonicalApiAst and returns a deterministic ValidationResult.
   */
  public static validate(ast: CanonicalApiAst, options: ValidationOptions = {}): ValidationResult {
    const rawFindings: ValidationFinding[] = [];

    // Guard: Root AST structure invariants
    rawFindings.push(...InvariantValidator.validateAstInvariants(ast));
    if (rawFindings.some((f) => f.code === 'AST_MALFORMED_STRUCTURE')) {
      return this.finalizeResult(rawFindings, options);
    }

    // 1. Structural Validation (Layer A)
    rawFindings.push(...StructuralValidator.validateMetadata(ast));

    for (const ep of ast.endpoints) {
      rawFindings.push(...StructuralValidator.validatePathFormat(ep));
      rawFindings.push(...StructuralValidator.validateHttpMethod(ep));
      rawFindings.push(...StructuralValidator.validateEndpointResponses(ep));
      rawFindings.push(...StructuralValidator.validateResponseStatusCodes(ep));
      rawFindings.push(...StructuralValidator.validateParameters(ep));
      rawFindings.push(...StructuralValidator.validateRequestBody(ep));
    }

    for (const [name, schema] of Object.entries(ast.schemas)) {
      rawFindings.push(...StructuralValidator.validateSchema(name, schema));
    }

    // 2. Semantic Validation (Layer B)
    for (const ep of ast.endpoints) {
      rawFindings.push(...SemanticValidator.validatePathParameters(ep));
      rawFindings.push(...SemanticValidator.validateResponseAndBodyCombinations(ep));
    }

    rawFindings.push(...SemanticValidator.validateDuplicateOperationIds(ast.endpoints));
    rawFindings.push(...SemanticValidator.validateDuplicateEndpoints(ast.endpoints));
    rawFindings.push(...SemanticValidator.validateSchemaReferences(ast));
    rawFindings.push(...SemanticValidator.validateSecuritySchemeReferences(ast));

    for (const [name, schema] of Object.entries(ast.schemas)) {
      rawFindings.push(...SemanticValidator.validateRequiredProperties(name, schema));
      rawFindings.push(...SemanticValidator.validateSchemaComposition(name, schema));
    }

    // 3. Invariant & Consistency Validation (Layer C)
    for (const ep of ast.endpoints) {
      rawFindings.push(...InvariantValidator.validateEndpointInvariants(ep));
    }

    for (const [name, schema] of Object.entries(ast.schemas)) {
      rawFindings.push(...InvariantValidator.validateSchemaInvariants(name, schema));
    }

    return this.finalizeResult(rawFindings, options);
  }

  /**
   * Deduplicates, filters, deterministically sorts findings, and computes statistics.
   */
  private static finalizeResult(
    rawFindings: ValidationFinding[],
    options: ValidationOptions
  ): ValidationResult {
    // 1. Deduplicate findings by unique ID
    const uniqueMap = new Map<string, ValidationFinding>();
    for (const f of rawFindings) {
      if (!uniqueMap.has(f.id)) {
        uniqueMap.set(f.id, f);
      }
    }

    let findings = Array.from(uniqueMap.values());

    // 2. Apply filters
    if (options.enabledCategories && options.enabledCategories.length > 0) {
      const enabled = new Set(options.enabledCategories);
      findings = findings.filter((f) => enabled.has(f.category));
    }

    if (options.ignoreCodes && options.ignoreCodes.length > 0) {
      const ignored = new Set(options.ignoreCodes);
      findings = findings.filter((f) => !ignored.has(f.code));
    }

    // 3. Handle treatWarningsAsErrors option
    if (options.treatWarningsAsErrors) {
      findings = findings.map((f) =>
        f.severity === 'warning' ? { ...f, severity: 'error' as ValidationSeverity } : f
      );
    }

    // 4. Deterministic Sort:
    // Primary: Severity rank (error -> warning -> info)
    // Secondary: Category alphabetically
    // Tertiary: EndpointId or Path alphabetically
    // Quaternary: Code alphabetically
    // Quinary: ID alphabetically
    findings.sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sevDiff !== 0) return sevDiff;

      const catDiff = a.category.localeCompare(b.category);
      if (catDiff !== 0) return catDiff;

      const targetA = a.endpointId || a.path || '';
      const targetB = b.endpointId || b.path || '';
      const targetDiff = targetA.localeCompare(targetB);
      if (targetDiff !== 0) return targetDiff;

      const codeDiff = a.code.localeCompare(b.code);
      if (codeDiff !== 0) return codeDiff;

      return a.id.localeCompare(b.id);
    });

    // 5. Compute statistics
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const f of findings) {
      if (f.severity === 'error') errorCount++;
      else if (f.severity === 'warning') warningCount++;
      else if (f.severity === 'info') infoCount++;
    }

    const stats: ValidationStats = {
      errorCount,
      warningCount,
      infoCount,
      totalCount: findings.length,
    };

    return {
      isValid: errorCount === 0,
      findings,
      stats,
    };
  }
}
