/**
 * @helios/validator
 * Layer C: AST Invariant Validation Rules.
 * Ensures the Canonical AST conforms to platform-wide structural integrity invariants
 * before consumption by downstream analysis engines.
 */

import type { CanonicalApiAst, CanonicalEndpoint, CanonicalSchema } from '@helios/canonical-ast';
import type { ValidationFinding } from '../types.js';

export class InvariantValidator {
  /**
   * Validates endpoint AST invariants (stable identity, valid method, valid path).
   */
  public static validateEndpointInvariants(endpoint: CanonicalEndpoint): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    // Stable ID must follow method:path format
    const expectedPrefix = `${endpoint.method}:`;
    if (!endpoint.id || !endpoint.id.startsWith(expectedPrefix)) {
      findings.push({
        id: `consistency:AST_MISSING_STABLE_ID:${endpoint.id || 'missing'}`,
        severity: 'error',
        category: 'consistency',
        code: 'AST_MISSING_STABLE_ID',
        message: `Endpoint is missing expected deterministic ID format "${expectedPrefix}${endpoint.path}". Got "${endpoint.id}".`,
        path: endpoint.path,
        endpointId: endpoint.id,
        suggestion: 'Ensure AST generation utilizes AstNormalizer.generateEndpointId.',
      });
    }

    if (!endpoint.path || !endpoint.path.startsWith('/')) {
      findings.push({
        id: `consistency:AST_INVALID_ENDPOINT_PATH:${endpoint.id}`,
        severity: 'error',
        category: 'consistency',
        code: 'AST_INVALID_ENDPOINT_PATH',
        message: `Endpoint "${endpoint.id}" violates normalized path invariant. Path must be non-empty and start with "/".`,
        path: endpoint.path,
        endpointId: endpoint.id,
      });
    }

    if (!endpoint.method || typeof endpoint.method !== 'string' || endpoint.method !== endpoint.method.toLowerCase()) {
      findings.push({
        id: `consistency:AST_INVALID_ENDPOINT_METHOD:${endpoint.id}`,
        severity: 'error',
        category: 'consistency',
        code: 'AST_INVALID_ENDPOINT_METHOD',
        message: `Endpoint "${endpoint.id}" violates method invariant. Method must be a lowercase standard verb.`,
        endpointId: endpoint.id,
      });
    }

    return findings;
  }

  /**
   * Validates schema invariants and emits informational notices for circular schemas.
   */
  public static validateSchemaInvariants(name: string, schema: CanonicalSchema): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    if (schema.isCircular) {
      findings.push({
        id: `consistency:AST_CIRCULAR_REFERENCE_WARNING:${name}`,
        severity: 'info',
        category: 'consistency',
        code: 'AST_CIRCULAR_REFERENCE_WARNING',
        message: `Schema "${name}" contains a circular or recursive reference.`,
        path: `components.schemas.${name}`,
        suggestion: 'Ensure recursive schemas have appropriate base-case termination conditions.',
      });
    }

    // Check that properties have valid CanonicalProperty shape
    if (schema.properties) {
      for (const [propName, prop] of Object.entries(schema.properties)) {
        if (!prop || typeof prop !== 'object' || typeof prop.required !== 'boolean') {
          findings.push({
            id: `consistency:AST_MALFORMED_STRUCTURE:${name}:${propName}`,
            severity: 'error',
            category: 'consistency',
            code: 'AST_MALFORMED_STRUCTURE',
            message: `Property "${propName}" in schema "${name}" violates CanonicalProperty invariant.`,
            path: `components.schemas.${name}.properties.${propName}`,
          });
        }
      }
    }

    return findings;
  }

  /**
   * Validates root AST structure invariants.
   */
  public static validateAstInvariants(ast: CanonicalApiAst): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    if (!ast || typeof ast !== 'object') {
      findings.push({
        id: 'consistency:AST_MALFORMED_STRUCTURE:root',
        severity: 'error',
        category: 'consistency',
        code: 'AST_MALFORMED_STRUCTURE',
        message: 'Specification AST is not a valid object.',
      });
      return findings;
    }

    if (!ast.id || typeof ast.id !== 'string') {
      findings.push({
        id: 'consistency:AST_MALFORMED_STRUCTURE:root:id',
        severity: 'error',
        category: 'consistency',
        code: 'AST_MALFORMED_STRUCTURE',
        message: 'AST root is missing a valid deterministic "id" string.',
      });
    }

    if (!Array.isArray(ast.endpoints)) {
      findings.push({
        id: 'consistency:AST_MALFORMED_STRUCTURE:root:endpoints',
        severity: 'error',
        category: 'consistency',
        code: 'AST_MALFORMED_STRUCTURE',
        message: 'AST root "endpoints" must be an array.',
      });
    }

    if (typeof ast.schemas !== 'object' || ast.schemas === null) {
      findings.push({
        id: 'consistency:AST_MALFORMED_STRUCTURE:root:schemas',
        severity: 'error',
        category: 'consistency',
        code: 'AST_MALFORMED_STRUCTURE',
        message: 'AST root "schemas" must be a dictionary object.',
      });
    }

    return findings;
  }
}
