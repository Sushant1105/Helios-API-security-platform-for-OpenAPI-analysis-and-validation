/**
 * @helios/validator
 * Layer A: Structural Validation Rules.
 * Validates syntax, required document metadata, path formatting, HTTP verbs,
 * parameter shapes, request body content, and response structures.
 */

import type { CanonicalApiAst, CanonicalEndpoint, CanonicalSchema } from '@helios/canonical-ast';
import { VALID_HTTP_METHODS } from '@helios/canonical-ast';
import type { ValidationFinding } from '../types.js';

export class StructuralValidator {
  /**
   * Validates document metadata (info.title and info.version).
   */
  public static validateMetadata(ast: CanonicalApiAst): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    if (!ast.info || !ast.info.title || ast.info.title.trim() === '' || ast.info.title === 'Untitled API') {
      findings.push({
        id: 'structure:MISSING_API_TITLE:root:title',
        severity: 'error',
        category: 'structure',
        code: 'MISSING_API_TITLE',
        message: 'Specification is missing a valid "info.title" field.',
        path: 'info.title',
        suggestion: 'Specify a descriptive API title in the info object.',
      });
    }

    if (!ast.info || !ast.info.version || ast.info.version.trim() === '' || ast.info.version === '0.0.0') {
      findings.push({
        id: 'structure:MISSING_API_VERSION:root:version',
        severity: 'error',
        category: 'structure',
        code: 'MISSING_API_VERSION',
        message: 'Specification is missing a valid "info.version" field.',
        path: 'info.version',
        suggestion: 'Specify a valid semantic API version (e.g., "1.0.0") in info.version.',
      });
    }

    return findings;
  }

  /**
   * Validates path formatting, template braces, and query strings.
   */
  public static validatePathFormat(endpoint: CanonicalEndpoint): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const path = endpoint.path;

    if (!path || path.trim() === '') {
      findings.push({
        id: `structure:INVALID_PATH_FORMAT:${endpoint.id}:empty`,
        severity: 'error',
        category: 'structure',
        code: 'INVALID_PATH_FORMAT',
        message: `Endpoint path cannot be empty.`,
        endpointId: endpoint.id,
        suggestion: 'Provide a valid relative path starting with "/".',
      });
      return findings;
    }

    if (!path.startsWith('/')) {
      findings.push({
        id: `structure:INVALID_PATH_FORMAT:${endpoint.id}:no-leading-slash`,
        severity: 'error',
        category: 'structure',
        code: 'INVALID_PATH_FORMAT',
        message: `Path "${path}" must start with a leading slash "/".`,
        path,
        endpointId: endpoint.id,
        suggestion: `Prefix the path with a leading slash: "/${path}".`,
      });
    }

    if (path.includes('?')) {
      findings.push({
        id: `structure:INVALID_PATH_FORMAT:${endpoint.id}:query-in-path`,
        severity: 'error',
        category: 'structure',
        code: 'INVALID_PATH_FORMAT',
        message: `Path "${path}" contains a query string. Query parameters must be defined in the parameters list, not the path string.`,
        path,
        endpointId: endpoint.id,
        suggestion: 'Remove query strings ("?... ") from the path definition and use "in: query" parameters.',
      });
    }

    // Check for unbalanced braces, e.g. /users/{id
    const openBraces = (path.match(/{/g) || []).length;
    const closeBraces = (path.match(/}/g) || []).length;
    if (openBraces !== closeBraces || /{}/.test(path) || /{[^}]*{/.test(path)) {
      findings.push({
        id: `structure:INVALID_PATH_FORMAT:${endpoint.id}:unbalanced-braces`,
        severity: 'error',
        category: 'structure',
        code: 'INVALID_PATH_FORMAT',
        message: `Path "${path}" has malformed or unbalanced template parameter braces.`,
        path,
        endpointId: endpoint.id,
        suggestion: 'Ensure all path parameters are properly enclosed in balanced curly braces like "{paramName}".',
      });
    }

    return findings;
  }

  /**
   * Validates HTTP method against standard verbs.
   */
  public static validateHttpMethod(endpoint: CanonicalEndpoint): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    if (!endpoint.method || !VALID_HTTP_METHODS.has(endpoint.method)) {
      findings.push({
        id: `structure:INVALID_HTTP_METHOD:${endpoint.id}:${endpoint.method || 'unknown'}`,
        severity: 'error',
        category: 'structure',
        code: 'INVALID_HTTP_METHOD',
        message: `Invalid or unsupported HTTP method "${endpoint.method}" for endpoint "${endpoint.path}".`,
        path: endpoint.path,
        endpointId: endpoint.id,
        suggestion: `Use a standard HTTP method: ${Array.from(VALID_HTTP_METHODS).join(', ')}.`,
      });
    }

    return findings;
  }

  /**
   * Validates that an endpoint has at least one response definition.
   */
  public static validateEndpointResponses(endpoint: CanonicalEndpoint): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    if (!endpoint.responses || Object.keys(endpoint.responses).length === 0) {
      findings.push({
        id: `structure:ENDPOINT_WITHOUT_RESPONSES:${endpoint.id}:responses`,
        severity: 'error',
        category: 'structure',
        code: 'ENDPOINT_WITHOUT_RESPONSES',
        message: `Endpoint "${endpoint.id}" defines no responses.`,
        path: endpoint.path,
        endpointId: endpoint.id,
        suggestion: 'Define at least one HTTP response status code (e.g., "200") or "default".',
      });
    }

    return findings;
  }

  /**
   * Validates response status code formats.
   */
  public static validateResponseStatusCodes(endpoint: CanonicalEndpoint): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    for (const [code, resp] of Object.entries(endpoint.responses)) {
      const trimmed = code.trim().toLowerCase();
      const isValid =
        trimmed === 'default' ||
        /^[1-5][0-9]{2}$/.test(trimmed) ||
        /^[1-5]xx$/.test(trimmed);

      if (!isValid) {
        findings.push({
          id: `structure:RESPONSE_WITHOUT_STATUS_CODE:${endpoint.id}:${code}`,
          severity: 'error',
          category: 'structure',
          code: 'RESPONSE_WITHOUT_STATUS_CODE',
          message: `Response code "${code}" on endpoint "${endpoint.id}" is not a valid 3-digit HTTP code (100-599), wildcard, or "default".`,
          path: `${endpoint.path}.responses.${code}`,
          endpointId: endpoint.id,
          suggestion: 'Use a standard 3-digit HTTP status code (e.g. "200", "404") or "default".',
        });
      }

      if (resp && typeof resp.description !== 'string') {
        findings.push({
          id: `structure:RESPONSE_WITHOUT_STATUS_CODE:${endpoint.id}:${code}:description`,
          severity: 'warning',
          category: 'structure',
          code: 'RESPONSE_WITHOUT_STATUS_CODE',
          message: `Response "${code}" on endpoint "${endpoint.id}" is missing a description string.`,
          path: `${endpoint.path}.responses.${code}.description`,
          endpointId: endpoint.id,
          suggestion: 'Provide a brief explanation describing when this response is returned.',
        });
      }
    }

    return findings;
  }

  /**
   * Validates parameter objects.
   */
  public static validateParameters(endpoint: CanonicalEndpoint): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const validLocations = new Set(['query', 'header', 'path', 'cookie']);

    for (const p of endpoint.parameters) {
      if (!p.name || p.name.trim() === '') {
        findings.push({
          id: `structure:INVALID_PARAMETER_STRUCTURE:${endpoint.id}:unnamed`,
          severity: 'error',
          category: 'structure',
          code: 'INVALID_PARAMETER_STRUCTURE',
          message: `Parameter on endpoint "${endpoint.id}" has an empty or missing "name".`,
          endpointId: endpoint.id,
          suggestion: 'Provide a non-empty string for the parameter name.',
        });
      }

      if (!p.in || !validLocations.has(p.in)) {
        findings.push({
          id: `structure:INVALID_PARAMETER_STRUCTURE:${endpoint.id}:${p.name || 'unknown'}:location`,
          severity: 'error',
          category: 'structure',
          code: 'INVALID_PARAMETER_STRUCTURE',
          message: `Parameter "${p.name}" on endpoint "${endpoint.id}" specifies invalid location "${p.in}".`,
          endpointId: endpoint.id,
          suggestion: 'Parameter "in" location must be one of: query, header, path, cookie.',
        });
      }
    }

    return findings;
  }

  /**
   * Validates request body structure.
   */
  public static validateRequestBody(endpoint: CanonicalEndpoint): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    if (endpoint.requestBody) {
      const content = endpoint.requestBody.content;
      if (!content || typeof content !== 'object' || Object.keys(content).length === 0) {
        findings.push({
          id: `structure:INVALID_REQUEST_BODY_STRUCTURE:${endpoint.id}:content`,
          severity: 'warning',
          category: 'structure',
          code: 'INVALID_REQUEST_BODY_STRUCTURE',
          message: `Request body on endpoint "${endpoint.id}" defines no content media types.`,
          endpointId: endpoint.id,
          suggestion: 'Define at least one content MIME type (e.g. "application/json") with a schema.',
        });
      }
    }

    return findings;
  }

  /**
   * Validates schema structure.
   */
  public static validateSchema(name: string, schema: CanonicalSchema): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const validTypes = new Set([
      'string',
      'number',
      'integer',
      'boolean',
      'array',
      'object',
      'null',
    ]);

    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      for (const t of types) {
        if (!validTypes.has(t)) {
          findings.push({
            id: `structure:INVALID_SCHEMA_STRUCTURE:${name}:${t}`,
            severity: 'error',
            category: 'structure',
            code: 'INVALID_SCHEMA_STRUCTURE',
            message: `Schema "${name}" declares unrecognized type "${t}".`,
            path: `components.schemas.${name}`,
            suggestion: `Use a valid JSON Schema type: ${Array.from(validTypes).join(', ')}.`,
          });
        }
      }
    }

    return findings;
  }
}
