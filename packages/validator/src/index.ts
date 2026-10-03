/**
 * @helios/validator
 * Public API for specification and Canonical AST structural, semantic,
 * reference, and consistency validation.
 */

import { buildCanonicalAst, type CanonicalApiAst } from '@helios/canonical-ast';
import type {
  ValidationCategory,
  ValidationCode,
  ValidationContext,
  ValidationFinding,
  ValidationOptions,
  ValidationResult,
  ValidationRule,
  ValidationSeverity,
  ValidationStats,
} from './types.js';
import { ValidatorEngine } from './engine.js';
import { StructuralValidator } from './rules/structural.js';
import { SemanticValidator } from './rules/semantic.js';
import { InvariantValidator } from './rules/invariant.js';

// Export domain types
export type {
  ValidationSeverity,
  ValidationCategory,
  ValidationCode,
  ValidationFinding,
  ValidationStats,
  ValidationResult,
  ValidationOptions,
  ValidationRule,
  ValidationContext,
};

// Export validation engine and individual validators
export {
  ValidatorEngine,
  StructuralValidator,
  SemanticValidator,
  InvariantValidator,
};

/**
 * Validates a CanonicalApiAst intermediate representation for structural,
 * semantic, reference, and consistency integrity.
 */
export function validateAst(
  ast: CanonicalApiAst,
  options?: ValidationOptions
): ValidationResult {
  return ValidatorEngine.validate(ast, options);
}

/**
 * Validates any specification input (raw object, parsed spec, or CanonicalApiAst).
 */
export function validateSpec(
  input: unknown,
  options?: ValidationOptions
): ValidationResult {
  // If input already conforms to CanonicalApiAst
  if (
    typeof input === 'object' &&
    input !== null &&
    'id' in input &&
    'endpoints' in input &&
    'schemas' in input &&
    'info' in input
  ) {
    return ValidatorEngine.validate(input as CanonicalApiAst, options);
  }

  // Otherwise, attempt AST normalization first
  const buildRes = buildCanonicalAst(input);
  if (!buildRes.success) {
    const errorFinding: ValidationFinding = {
      id: `structure:${buildRes.error.code}:root`,
      severity: 'error',
      category: 'structure',
      code: (buildRes.error.code === 'INVALID_INVARIANT'
        ? 'MISSING_API_TITLE'
        : 'INVALID_SCHEMA_STRUCTURE') as ValidationCode,
      message: buildRes.error.message,
      suggestion: 'Fix structural syntax or metadata errors in the input specification.',
    };

    return {
      isValid: false,
      findings: [errorFinding],
      stats: {
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
        totalCount: 1,
      },
    };
  }

  return ValidatorEngine.validate(buildRes.data, options);
}

// Backward compatibility types for Phase 0 scaffolding
export type ValidationDiagnostic = ValidationFinding;
export type ValidationReport = ValidationResult;
