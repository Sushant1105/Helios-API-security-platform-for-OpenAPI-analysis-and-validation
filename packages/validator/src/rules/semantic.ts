/**
 * @helios/validator
 * Layer B: Semantic Validation Rules.
 * Validates path parameter declarations, operationId uniqueness, reference integrity,
 * schema property presence, response/body compatibility, and composition.
 */

import type { CanonicalApiAst, CanonicalEndpoint, CanonicalSchema } from '@helios/canonical-ast';
import type { ValidationFinding } from '../types.js';

export class SemanticValidator {
  /**
   * Validates path parameters declared in path templates vs parameters list.
   */
  public static validatePathParameters(endpoint: CanonicalEndpoint): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const path = endpoint.path;

    // Extract all {param} tokens from the path
    const pathParamRegex = /{([^}]+)}/g;
    const tokens: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pathParamRegex.exec(path)) !== null) {
      if (match[1]) {
        tokens.push(match[1].trim());
      }
    }

    const pathParams = endpoint.parameters.filter((p) => p.in === 'path');
    const pathParamNames = new Set(pathParams.map((p) => p.name));

    // 1. Every path template token must have an in: 'path' parameter
    for (const token of tokens) {
      if (!pathParamNames.has(token)) {
        findings.push({
          id: `semantic:UNDECLARED_PATH_PARAMETER:${endpoint.id}:${token}`,
          severity: 'error',
          category: 'semantic',
          code: 'UNDECLARED_PATH_PARAMETER',
          message: `Path template variable "{${token}}" on endpoint "${endpoint.id}" is not declared in parameters.`,
          path: endpoint.path,
          endpointId: endpoint.id,
          suggestion: `Add an "in: path" parameter with name "${token}" to endpoint parameters.`,
        });
      }
    }

    // 2. Every in: 'path' parameter must exist in the path template
    for (const p of pathParams) {
      if (!tokens.includes(p.name)) {
        findings.push({
          id: `semantic:UNDECLARED_PATH_PARAMETER:${endpoint.id}:${p.name}:orphan`,
          severity: 'warning',
          category: 'semantic',
          code: 'UNDECLARED_PATH_PARAMETER',
          message: `Parameter "${p.name}" is declared with "in: path" on endpoint "${endpoint.id}", but "{${p.name}}" does not exist in path template.`,
          path: endpoint.path,
          endpointId: endpoint.id,
          suggestion: `Include "{${p.name}}" in the path string or change parameter location.`,
        });
      }

      // 3. Path parameter must be marked required: true
      if (p.required === false) {
        findings.push({
          id: `semantic:OPTIONAL_PATH_PARAMETER:${endpoint.id}:${p.name}`,
          severity: 'error',
          category: 'semantic',
          code: 'OPTIONAL_PATH_PARAMETER',
          message: `Path parameter "${p.name}" on endpoint "${endpoint.id}" cannot have required: false. Path parameters must be required.`,
          path: endpoint.path,
          endpointId: endpoint.id,
          suggestion: `Set "required: true" for path parameter "${p.name}".`,
        });
      }
    }

    return findings;
  }

  /**
   * Validates operationId uniqueness across all endpoints in the specification.
   */
  public static validateDuplicateOperationIds(endpoints: CanonicalEndpoint[]): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const seenOperationIds = new Map<string, string>(); // operationId -> first endpoint.id

    for (const ep of endpoints) {
      if (ep.operationId) {
        const opId = ep.operationId.trim();
        if (seenOperationIds.has(opId)) {
          const firstEp = seenOperationIds.get(opId)!;
          findings.push({
            id: `semantic:DUPLICATE_OPERATION_ID:${ep.id}:${opId}`,
            severity: 'error',
            category: 'semantic',
            code: 'DUPLICATE_OPERATION_ID',
            message: `Duplicate operationId "${opId}" detected on endpoint "${ep.id}". First defined on "${firstEp}".`,
            path: ep.path,
            endpointId: ep.id,
            suggestion: `Assign a unique operationId to "${ep.id}".`,
          });
        } else {
          seenOperationIds.set(opId, ep.id);
        }
      }
    }

    return findings;
  }

  /**
   * Validates endpoint identity uniqueness (method + normalized path).
   */
  public static validateDuplicateEndpoints(endpoints: CanonicalEndpoint[]): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const seenEndpoints = new Set<string>();

    for (const ep of endpoints) {
      if (seenEndpoints.has(ep.id)) {
        findings.push({
          id: `semantic:DUPLICATE_ENDPOINT_IDENTITY:${ep.id}`,
          severity: 'error',
          category: 'semantic',
          code: 'DUPLICATE_ENDPOINT_IDENTITY',
          message: `Duplicate endpoint identity "${ep.id}" detected. An API cannot have multiple operations on the same method and path.`,
          path: ep.path,
          endpointId: ep.id,
          suggestion: `Disambiguate or combine operations for "${ep.id}".`,
        });
      } else {
        seenEndpoints.add(ep.id);
      }
    }

    return findings;
  }

  /**
   * Validates local schema references point to defined schemas in components.schemas.
   */
  public static validateSchemaReferences(ast: CanonicalApiAst): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const definedSchemas = new Set(Object.keys(ast.schemas));

    const checkSchemaRef = (schema: CanonicalSchema | undefined, contextPath: string) => {
      if (!schema) return;

      if (schema.rawRef) {
        const prefix = '#/components/schemas/';
        if (schema.rawRef.startsWith(prefix)) {
          const refName = schema.rawRef.slice(prefix.length);
          if (!definedSchemas.has(refName)) {
            findings.push({
              id: `reference:UNDEFINED_SCHEMA_REFERENCE:${contextPath}:${refName}`,
              severity: 'error',
              category: 'reference',
              code: 'UNDEFINED_SCHEMA_REFERENCE',
              message: `Reference "${schema.rawRef}" at "${contextPath}" targets non-existent schema "${refName}".`,
              path: contextPath,
              suggestion: `Define schema "${refName}" under components.schemas or correct the reference pointer.`,
            });
          }
        }
      }

      if (schema.properties) {
        for (const [propName, prop] of Object.entries(schema.properties)) {
          checkSchemaRef(prop.schema, `${contextPath}.${propName}`);
        }
      }

      if (schema.items) {
        checkSchemaRef(schema.items, `${contextPath}.items`);
      }

      if (schema.allOf) {
        schema.allOf.forEach((s, idx) => checkSchemaRef(s, `${contextPath}.allOf[${idx}]`));
      }
      if (schema.anyOf) {
        schema.anyOf.forEach((s, idx) => checkSchemaRef(s, `${contextPath}.anyOf[${idx}]`));
      }
      if (schema.oneOf) {
        schema.oneOf.forEach((s, idx) => checkSchemaRef(s, `${contextPath}.oneOf[${idx}]`));
      }
    };

    // Check top-level schemas
    for (const [name, schema] of Object.entries(ast.schemas)) {
      checkSchemaRef(schema, `components.schemas.${name}`);
    }

    // Check endpoint parameters, request bodies, and responses
    for (const ep of ast.endpoints) {
      for (const p of ep.parameters) {
        checkSchemaRef(p.schema, `${ep.id}.parameters.${p.name}`);
      }

      if (ep.requestBody) {
        for (const [media, mObj] of Object.entries(ep.requestBody.content)) {
          checkSchemaRef(mObj.schema, `${ep.id}.requestBody.${media}`);
        }
      }

      for (const [code, resp] of Object.entries(ep.responses)) {
        if (resp.content) {
          for (const [media, mObj] of Object.entries(resp.content)) {
            checkSchemaRef(mObj.schema, `${ep.id}.responses.${code}.${media}`);
          }
        }
      }
    }

    return findings;
  }

  /**
   * Validates security requirements reference schemes defined in components.securitySchemes.
   */
  public static validateSecuritySchemeReferences(ast: CanonicalApiAst): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const definedSchemes = new Set(Object.keys(ast.securitySchemes));

    // Check global security requirements
    for (const sec of ast.security) {
      if (!definedSchemes.has(sec.name)) {
        findings.push({
          id: `reference:UNDEFINED_SECURITY_SCHEME_REFERENCE:global:${sec.name}`,
          severity: 'error',
          category: 'reference',
          code: 'UNDEFINED_SECURITY_SCHEME_REFERENCE',
          message: `Global security requirement references undefined security scheme "${sec.name}".`,
          suggestion: `Define security scheme "${sec.name}" in components.securitySchemes or remove the requirement.`,
        });
      }
    }

    // Check operation security requirements
    for (const ep of ast.endpoints) {
      if (ep.security) {
        for (const sec of ep.security) {
          if (!definedSchemes.has(sec.name)) {
            findings.push({
              id: `reference:UNDEFINED_SECURITY_SCHEME_REFERENCE:${ep.id}:${sec.name}`,
              severity: 'error',
              category: 'reference',
              code: 'UNDEFINED_SECURITY_SCHEME_REFERENCE',
              message: `Endpoint "${ep.id}" references undefined security scheme "${sec.name}".`,
              path: ep.path,
              endpointId: ep.id,
              suggestion: `Define security scheme "${sec.name}" in components.securitySchemes or remove the requirement.`,
            });
          }
        }
      }
    }

    return findings;
  }

  /**
   * Validates that all properties declared in requiredProperties exist in properties.
   */
  public static validateRequiredProperties(name: string, schema: CanonicalSchema): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    if (schema.requiredProperties && schema.requiredProperties.length > 0) {
      const definedProperties = new Set(schema.properties ? Object.keys(schema.properties) : []);

      for (const reqProp of schema.requiredProperties) {
        if (!definedProperties.has(reqProp)) {
          findings.push({
            id: `semantic:REQUIRED_PROPERTY_NOT_DEFINED:${name}:${reqProp}`,
            severity: 'error',
            category: 'semantic',
            code: 'REQUIRED_PROPERTY_NOT_DEFINED',
            message: `Schema "${name}" declares required property "${reqProp}", but it is not defined in properties.`,
            path: `components.schemas.${name}.required`,
            suggestion: `Add property "${reqProp}" to properties or remove it from the required list.`,
          });
        }
      }
    }

    return findings;
  }

  /**
   * Validates response and body combinations (e.g. 204 or 304 cannot have response body).
   */
  public static validateResponseAndBodyCombinations(endpoint: CanonicalEndpoint): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    for (const [code, resp] of Object.entries(endpoint.responses)) {
      if (code === '204' || code === '304') {
        if (resp.content && Object.keys(resp.content).length > 0) {
          findings.push({
            id: `semantic:INVALID_RESPONSE_BODY_COMBINATION:${endpoint.id}:${code}`,
            severity: 'error',
            category: 'semantic',
            code: 'INVALID_RESPONSE_BODY_COMBINATION',
            message: `HTTP response ${code} on endpoint "${endpoint.id}" specifies a response content body. RFC 9110 forbids content in ${code} responses.`,
            path: `${endpoint.path}.responses.${code}.content`,
            endpointId: endpoint.id,
            suggestion: `Remove the "content" block from the ${code} response definition.`,
          });
        }
      }
    }

    return findings;
  }

  /**
   * Validates schema composition (detecting conflicting types in allOf).
   */
  public static validateSchemaComposition(name: string, schema: CanonicalSchema): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    if (schema.allOf && schema.allOf.length > 1) {
      const primitiveTypes = new Set<string>();

      for (const item of schema.allOf) {
        if (typeof item.type === 'string' && item.type !== 'object' && item.type !== 'null') {
          primitiveTypes.add(item.type);
        }
      }

      // If allOf contains multiple distinct non-object primitive types (e.g. string AND number)
      if (primitiveTypes.size > 1) {
        findings.push({
          id: `semantic:INVALID_SCHEMA_COMPOSITION:${name}:conflicting-types`,
          severity: 'error',
          category: 'semantic',
          code: 'INVALID_SCHEMA_COMPOSITION',
          message: `Schema "${name}" has conflicting primitive types [${Array.from(primitiveTypes).join(', ')}] in allOf composition. A value cannot satisfy multiple incompatible primitive types simultaneously.`,
          path: `components.schemas.${name}.allOf`,
          suggestion: 'Ensure composed schemas do not specify contradictory primitive types.',
        });
      }
    }

    return findings;
  }
}
