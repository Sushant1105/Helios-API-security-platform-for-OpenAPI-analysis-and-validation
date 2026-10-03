/**
 * @helios/validator
 * Comprehensive unit test suite covering:
 * - Structural, semantic, and invariant validation
 * - Missing metadata, invalid paths, unsupported verbs, missing responses
 * - Duplicate operationIds, duplicate endpoints
 * - Undeclared and optional path parameters
 * - Undefined schema references and undefined security schemes
 * - Missing required schema properties, conflicting composition
 * - Deterministic ordering and finding IDs
 * - Multi-finding accumulation and stats
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalApiAst } from '@helios/canonical-ast';
import { validateAst, validateSpec } from '../index.js';

function createValidAst(): CanonicalApiAst {
  return {
    id: 'test-api:1.0.0',
    title: 'Test API',
    version: '1.0.0',
    specVersion: '3.1',
    format: 'yaml',
    info: {
      title: 'Test API',
      version: '1.0.0',
      description: 'A valid test specification',
    },
    servers: [{ url: 'https://api.example.com/v1' }],
    tags: [{ name: 'Items' }],
    endpoints: [
      {
        id: 'get:/items',
        path: '/items',
        method: 'get',
        operationId: 'listItems',
        deprecated: false,
        tags: ['Items'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            deprecated: false,
            schema: {
              nullable: false,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
              type: 'integer',
            },
          },
        ],
        responses: {
          '200': {
            statusCode: '200',
            description: 'List of items',
            content: {
              'application/json': {
                schema: {
                  nullable: false,
                  readOnly: false,
                  writeOnly: false,
                  deprecated: false,
                  requiredProperties: [],
                  type: 'array',
                  items: {
                    nullable: false,
                    readOnly: false,
                    writeOnly: false,
                    deprecated: false,
                    requiredProperties: ['id'],
                    type: 'object',
                    properties: {
                      id: {
                        name: 'id',
                        required: true,
                        schema: {
                          nullable: false,
                          readOnly: false,
                          writeOnly: false,
                          deprecated: false,
                          requiredProperties: [],
                          type: 'string',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
    schemas: {
      Item: {
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: ['id'],
        type: 'object',
        properties: {
          id: {
            name: 'id',
            required: true,
            schema: {
              nullable: false,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
              type: 'string',
            },
          },
        },
      },
    },
    securitySchemes: {
      BearerAuth: {
        id: 'BearerAuth',
        type: 'http',
        scheme: 'bearer',
      },
    },
    security: [{ name: 'BearerAuth', scopes: [] }],
    metadata: {
      normalizedAt: new Date().toISOString(),
      sourceFormat: 'yaml',
      specVersion: '3.1',
      totalEndpoints: 1,
      totalSchemas: 1,
    },
  };
}

describe('Specification and AST Validator (Phase 3)', () => {
  // Test 1: Valid AST with no findings
  it('should validate a clean AST with 0 findings and isValid === true', () => {
    const ast = createValidAst();
    const result = validateAst(ast);

    assert.equal(result.isValid, true);
    assert.equal(result.findings.length, 0);
    assert.equal(result.stats.errorCount, 0);
    assert.equal(result.stats.warningCount, 0);
    assert.equal(result.stats.totalCount, 0);
  });

  // Test 2: Missing API metadata
  it('should report MISSING_API_TITLE and MISSING_API_VERSION', () => {
    const ast = createValidAst();
    ast.info.title = '';
    ast.info.version = '';

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const titleFinding = result.findings.find((f) => f.code === 'MISSING_API_TITLE');
    assert.ok(titleFinding);
    assert.equal(titleFinding.severity, 'error');
    assert.equal(titleFinding.category, 'structure');

    const versionFinding = result.findings.find((f) => f.code === 'MISSING_API_VERSION');
    assert.ok(versionFinding);
    assert.equal(versionFinding.severity, 'error');
  });

  // Test 3: Invalid paths (missing leading slash, empty, unclosed braces)
  it('should report INVALID_PATH_FORMAT for malformed paths', () => {
    const ast = createValidAst();
    ast.endpoints[0]!.path = 'items/{id'; // missing leading slash & unclosed brace

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const pathFindings = result.findings.filter((f) => f.code === 'INVALID_PATH_FORMAT');
    assert.ok(pathFindings.length >= 1);
    assert.equal(pathFindings[0]?.category, 'structure');
  });

  // Test 4: Unsupported HTTP methods
  it('should report INVALID_HTTP_METHOD for unsupported verbs', () => {
    const ast = createValidAst();
    (ast.endpoints[0] as any).method = 'invalidverb';

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'INVALID_HTTP_METHOD');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
  });

  // Test 5: Endpoint without responses
  it('should report ENDPOINT_WITHOUT_RESPONSES when responses map is empty', () => {
    const ast = createValidAst();
    ast.endpoints[0]!.responses = {};

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'ENDPOINT_WITHOUT_RESPONSES');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
  });

  // Test 6: Missing or invalid response status code
  it('should report RESPONSE_WITHOUT_STATUS_CODE for non-standard status codes', () => {
    const ast = createValidAst();
    ast.endpoints[0]!.responses = {
      '999': { statusCode: '999', description: 'Invalid code' },
    };

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'RESPONSE_WITHOUT_STATUS_CODE');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
  });

  // Test 7: Duplicate operationId
  it('should report DUPLICATE_OPERATION_ID when multiple endpoints share an operationId', () => {
    const ast = createValidAst();
    ast.endpoints.push({
      id: 'post:/items',
      path: '/items',
      method: 'post',
      operationId: 'listItems', // duplicate with get:/items
      deprecated: false,
      tags: [],
      parameters: [],
      responses: { '201': { statusCode: '201', description: 'Created' } },
    });

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'DUPLICATE_OPERATION_ID');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
    assert.equal(finding.category, 'semantic');
    assert.match(finding.message, /listItems/);
  });

  // Test 8: Duplicate endpoint identity
  it('should report DUPLICATE_ENDPOINT_IDENTITY when multiple endpoints have identical method and path', () => {
    const ast = createValidAst();
    ast.endpoints.push({
      id: 'get:/items', // duplicate identity
      path: '/items',
      method: 'get',
      deprecated: false,
      tags: [],
      parameters: [],
      responses: { '200': { statusCode: '200', description: 'OK' } },
    });

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'DUPLICATE_ENDPOINT_IDENTITY');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
  });

  // Test 9: Undeclared path parameter
  it('should report UNDECLARED_PATH_PARAMETER when path template has variables not in parameters', () => {
    const ast = createValidAst();
    ast.endpoints[0]!.path = '/items/{itemId}/details/{subId}';
    ast.endpoints[0]!.parameters = []; // neither itemId nor subId declared

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const findings = result.findings.filter((f) => f.code === 'UNDECLARED_PATH_PARAMETER');
    assert.equal(findings.length, 2);
    assert.ok(findings.some((f) => f.message.includes('itemId')));
    assert.ok(findings.some((f) => f.message.includes('subId')));
  });

  // Test 10: Optional path parameter
  it('should report OPTIONAL_PATH_PARAMETER when path parameter has required === false', () => {
    const ast = createValidAst();
    ast.endpoints[0]!.path = '/items/{id}';
    ast.endpoints[0]!.parameters = [
      {
        name: 'id',
        in: 'path',
        required: false, // Invalid for path params
        deprecated: false,
      },
    ];

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'OPTIONAL_PATH_PARAMETER');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
    assert.match(finding.message, /required: false/);
  });

  // Test 11: Undefined schema reference
  it('should report UNDEFINED_SCHEMA_REFERENCE when $ref targets non-existent schema', () => {
    const ast = createValidAst();
    ast.schemas['Order'] = {
      nullable: false,
      readOnly: false,
      writeOnly: false,
      deprecated: false,
      requiredProperties: [],
      rawRef: '#/components/schemas/NonExistentModel',
    };

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'UNDEFINED_SCHEMA_REFERENCE');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
    assert.equal(finding.category, 'reference');
    assert.match(finding.message, /NonExistentModel/);
  });

  // Test 12: Undefined security scheme reference
  it('should report UNDEFINED_SECURITY_SCHEME_REFERENCE when security refers to missing scheme', () => {
    const ast = createValidAst();
    ast.endpoints[0]!.security = [{ name: 'UnknownAuthScheme', scopes: [] }];

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'UNDEFINED_SECURITY_SCHEME_REFERENCE');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
    assert.equal(finding.category, 'reference');
    assert.match(finding.message, /UnknownAuthScheme/);
  });

  // Test 13: Required property missing from properties
  it('should report REQUIRED_PROPERTY_NOT_DEFINED when required property is missing in properties', () => {
    const ast = createValidAst();
    ast.schemas['UserProfile'] = {
      nullable: false,
      readOnly: false,
      writeOnly: false,
      deprecated: false,
      requiredProperties: ['id', 'email', 'missingField'],
      properties: {
        id: {
          name: 'id',
          required: true,
          schema: { nullable: false, readOnly: false, writeOnly: false, deprecated: false, requiredProperties: [], type: 'string' },
        },
        email: {
          name: 'email',
          required: true,
          schema: { nullable: false, readOnly: false, writeOnly: false, deprecated: false, requiredProperties: [], type: 'string' },
        },
      },
    };

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'REQUIRED_PROPERTY_NOT_DEFINED');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
    assert.match(finding.message, /missingField/);
  });

  // Test 14: Invalid response body combination (204 with body)
  it('should report INVALID_RESPONSE_BODY_COMBINATION when HTTP 204 defines response content', () => {
    const ast = createValidAst();
    ast.endpoints[0]!.responses['204'] = {
      statusCode: '204',
      description: 'No content with forbidden body',
      content: {
        'application/json': {
          schema: { nullable: false, readOnly: false, writeOnly: false, deprecated: false, requiredProperties: [], type: 'string' },
        },
      },
    };

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'INVALID_RESPONSE_BODY_COMBINATION');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
  });

  // Test 15: Invalid schema composition
  it('should report INVALID_SCHEMA_COMPOSITION when allOf specifies conflicting primitive types', () => {
    const ast = createValidAst();
    ast.schemas['ImpossibleType'] = {
      nullable: false,
      readOnly: false,
      writeOnly: false,
      deprecated: false,
      requiredProperties: [],
      allOf: [
        { nullable: false, readOnly: false, writeOnly: false, deprecated: false, requiredProperties: [], type: 'string' },
        { nullable: false, readOnly: false, writeOnly: false, deprecated: false, requiredProperties: [], type: 'number' },
      ],
    };

    const result = validateAst(ast);
    assert.equal(result.isValid, false);

    const finding = result.findings.find((f) => f.code === 'INVALID_SCHEMA_COMPOSITION');
    assert.ok(finding);
    assert.equal(finding.severity, 'error');
    assert.match(finding.message, /conflicting primitive types/);
  });

  // Test 16: Deterministic finding ordering and reproducible IDs
  it('should produce 100% deterministic finding ordering and IDs across multiple runs', () => {
    const ast = createValidAst();
    ast.info.title = ''; // MISSING_API_TITLE
    ast.endpoints[0]!.path = '/items/{id}'; // UNDECLARED_PATH_PARAMETER
    ast.endpoints[0]!.parameters = [];
    ast.endpoints[0]!.responses = {}; // ENDPOINT_WITHOUT_RESPONSES

    const result1 = validateAst(ast);
    const result2 = validateAst(ast);

    assert.equal(result1.findings.length, result2.findings.length);
    assert.deepEqual(
      result1.findings.map((f) => f.id),
      result2.findings.map((f) => f.id)
    );

    // Verify IDs follow deterministic format: category:code:target:subKey
    for (const f of result1.findings) {
      assert.ok(f.id.startsWith(f.category));
      assert.ok(f.id.includes(f.code));
    }
  });

  // Test 17: validateSpec utility with raw spec object
  it('should validate spec from raw input via validateSpec', () => {
    const rawSpec = {
      info: { title: 'Raw Spec', version: '1.0.0' },
      paths: {
        '/test': {
          get: {
            responses: {
              '200': { description: 'OK' },
            },
          },
        },
      },
    };

    const result = validateSpec(rawSpec);
    assert.equal(result.isValid, true);
    assert.equal(result.stats.errorCount, 0);
  });
});
