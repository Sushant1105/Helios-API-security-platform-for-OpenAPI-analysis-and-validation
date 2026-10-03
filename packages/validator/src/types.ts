/**
 * @helios/validator
 * Strongly-typed domain models for API specification and Canonical AST validation:
 * findings, severity tiers, validation categories, and diagnostic codes.
 */

import type { SourceLocation } from '@helios/shared';
import type { CanonicalApiAst } from '@helios/canonical-ast';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationCategory =
  | 'structure'
  | 'semantic'
  | 'reference'
  | 'consistency'
  | 'compatibility';

export type ValidationCode =
  // Structural Validation Codes
  | 'MISSING_API_TITLE'
  | 'MISSING_API_VERSION'
  | 'INVALID_PATH_FORMAT'
  | 'INVALID_HTTP_METHOD'
  | 'ENDPOINT_WITHOUT_RESPONSES'
  | 'RESPONSE_WITHOUT_STATUS_CODE'
  | 'INVALID_PARAMETER_STRUCTURE'
  | 'INVALID_REQUEST_BODY_STRUCTURE'
  | 'INVALID_SCHEMA_STRUCTURE'
  // Semantic Validation Codes
  | 'UNDECLARED_PATH_PARAMETER'
  | 'OPTIONAL_PATH_PARAMETER'
  | 'DUPLICATE_OPERATION_ID'
  | 'DUPLICATE_ENDPOINT_IDENTITY'
  | 'UNDEFINED_SCHEMA_REFERENCE'
  | 'UNDEFINED_SECURITY_SCHEME_REFERENCE'
  | 'REQUIRED_PROPERTY_NOT_DEFINED'
  | 'INVALID_RESPONSE_BODY_COMBINATION'
  | 'INVALID_REQUEST_RESPONSE_REFERENCE'
  | 'INVALID_SCHEMA_COMPOSITION'
  // AST Invariant & Consistency Codes
  | 'AST_INVALID_ENDPOINT_PATH'
  | 'AST_INVALID_ENDPOINT_METHOD'
  | 'AST_MISSING_STABLE_ID'
  | 'AST_MALFORMED_STRUCTURE'
  | 'AST_CIRCULAR_REFERENCE_WARNING';

export interface ValidationFinding {
  readonly id: string; // Deterministic ID: "${category}:${code}:${target}:${subKey}"
  readonly severity: ValidationSeverity;
  readonly category: ValidationCategory;
  readonly code: ValidationCode;
  readonly message: string;
  readonly path?: string;
  readonly endpointId?: string;
  readonly suggestion?: string;
  readonly location?: SourceLocation;
}

export interface ValidationStats {
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly totalCount: number;
}

export interface ValidationResult {
  readonly isValid: boolean; // true if errorCount === 0
  readonly findings: readonly ValidationFinding[];
  readonly stats: ValidationStats;
}

export interface ValidationOptions {
  readonly enabledCategories?: readonly ValidationCategory[];
  readonly ignoreCodes?: readonly ValidationCode[];
  readonly treatWarningsAsErrors?: boolean;
}

export interface ValidationContext {
  readonly options?: ValidationOptions;
}

export interface ValidationRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ValidationCategory;
  readonly defaultSeverity: ValidationSeverity;
  validate(ast: CanonicalApiAst, context?: ValidationContext): ValidationFinding[];
}
