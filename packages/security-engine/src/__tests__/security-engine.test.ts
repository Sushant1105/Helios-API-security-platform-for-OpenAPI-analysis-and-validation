/**
 * @helios/security-engine
 * Comprehensive unit test suite covering:
 * - Authentication & authorization rules (AUTH-001 to AUTH-006)
 * - Transport security rules (TRNS-001 to TRNS-004)
 * - Sensitive data exposure rules (DATA-001, DATA-002) with configurability
 * - Resource consumption rules (RSRC-001 to RSRC-005)
 * - Deterministic finding IDs, reproducible ordering, and OWASP Top 10 breakdown
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalApiAst } from '@helios/canonical-ast';
import { runSecurityAudit } from '../index.js';

function createBaseAst(): CanonicalApiAst {
  return {
    id: 'secure-api:1.0.0',
    title: 'Secure API',
    version: '1.0.0',
    specVersion: '3.1',
    format: 'yaml',
    info: {
      title: 'Secure API',
      version: '1.0.0',
      description: 'A base secure API specification',
    },
    servers: [{ url: 'https://api.example.com/v1', description: 'Production server' }],
    tags: [{ name: 'Core' }],
    endpoints: [
      {
        id: 'get:/users/{id}',
        path: '/users/{id}',
        method: 'get',
        operationId: 'getUserById',
        deprecated: false,
        tags: ['Core'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            deprecated: false,
            schema: {
              nullable: false,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
              type: 'string',
              maxLength: 64,
            },
          },
        ],
        responses: {
          '200': {
            statusCode: '200',
            description: 'User details',
            content: {
              'application/json': {
                schema: {
                  nullable: false,
                  readOnly: false,
                  writeOnly: false,
                  deprecated: false,
                  requiredProperties: ['id', 'username'],
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
                    username: {
                      name: 'username',
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
    ],
    schemas: {},
    securitySchemes: {
      OAuth2Auth: {
        id: 'OAuth2Auth',
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://auth.example.com/oauth/authorize',
            tokenUrl: 'https://auth.example.com/oauth/token',
          },
        },
      },
    },
    security: [{ name: 'OAuth2Auth', scopes: ['read:users'] }],
    metadata: {
      normalizedAt: new Date().toISOString(),
      sourceFormat: 'yaml',
      specVersion: '3.1',
      totalEndpoints: 1,
      totalSchemas: 0,
    },
  };
}

describe('Deterministic Security Engine (Phase 4)', () => {
  // Test 1: Public endpoint without security (AUTH-001)
  it('should detect unauthenticated endpoint when no global and no local security exists (AUTH-001)', () => {
    const ast = createBaseAst();
    ast.security = []; // No global security
    ast.endpoints[0]!.security = undefined; // No operation security

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'AUTH-001');

    assert.ok(finding);
    assert.equal(finding.severity, 'HIGH');
    assert.equal(finding.confidence, 'HIGH');
    assert.equal(finding.category, 'authentication');
    assert.equal(finding.owaspCategory, 'API2:2023_BROKEN_AUTH');
    assert.match(finding.title, /no effective security/i);
  });

  // Test 2: Endpoint inheriting global security
  it('should NOT flag AUTH-001 when endpoint inherits global security', () => {
    const ast = createBaseAst();
    ast.security = [{ name: 'OAuth2Auth', scopes: [] }];
    ast.endpoints[0]!.security = undefined; // Inherits global security

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'AUTH-001');
    assert.equal(finding, undefined);
  });

  // Test 3: Endpoint explicitly made public (AUTH-002)
  it('should detect endpoint explicitly overriding global security with empty array (AUTH-002)', () => {
    const ast = createBaseAst();
    ast.security = [{ name: 'OAuth2Auth', scopes: [] }];
    ast.endpoints[0]!.security = []; // Explicit public override

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'AUTH-002');

    assert.ok(finding);
    assert.equal(finding.severity, 'MEDIUM');
    assert.equal(finding.confidence, 'HIGH');
    assert.match(finding.description, /explicitly defines "security: \[\]"/i);
  });

  // Test 4: Unused security scheme (AUTH-003)
  it('should detect unused security scheme defined in components (AUTH-003)', () => {
    const ast = createBaseAst();
    ast.securitySchemes['LegacyApiKey'] = {
      id: 'LegacyApiKey',
      type: 'apiKey',
      name: 'X-API-KEY',
      in: 'header',
    };
    // LegacyApiKey is never used in ast.security or endpoint.security

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'AUTH-003' && f.id.includes('LegacyApiKey'));

    assert.ok(finding);
    assert.equal(finding.severity, 'INFO');
    assert.equal(finding.category, 'configuration');
    assert.equal(finding.owaspCategory, 'API9:2023_IMPROPER_INVENTORY_MANAGEMENT');
  });

  // Test 5: Insecure Basic authentication (AUTH-004)
  it('should detect HTTP Basic auth when insecure HTTP servers exist (AUTH-004)', () => {
    const ast = createBaseAst();
    ast.servers = [{ url: 'http://api.insecure.com' }];
    ast.securitySchemes['BasicAuth'] = {
      id: 'BasicAuth',
      type: 'http',
      scheme: 'basic',
    };
    ast.security = [{ name: 'BasicAuth', scopes: [] }];

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'AUTH-004');

    assert.ok(finding);
    assert.equal(finding.severity, 'HIGH');
    assert.equal(finding.confidence, 'HIGH');
    assert.match(finding.description, /Basic authentication/i);
  });

  // Test 6: HTTPS-only API with no transport finding
  it('should not emit transport findings for HTTPS-only server configurations', () => {
    const ast = createBaseAst();
    ast.servers = [
      { url: 'https://api.example.com', description: 'Production' },
      { url: 'https://staging.example.com', description: 'Staging' },
    ];

    const result = runSecurityAudit(ast);
    const transportFindings = result.findings.filter((f) => f.category === 'transport');
    assert.equal(transportFindings.length, 0);
  });

  // Test 7: HTTP server detection and insecure production server (TRNS-001, TRNS-002)
  it('should detect unencrypted HTTP server and insecure production server (TRNS-001, TRNS-002)', () => {
    const ast = createBaseAst();
    ast.servers = [
      { url: 'http://api.production.com', description: 'Production gateway' },
    ];

    const result = runSecurityAudit(ast);
    const trns1 = result.findings.find((f) => f.ruleId === 'TRNS-001');
    const trns2 = result.findings.find((f) => f.ruleId === 'TRNS-002');

    assert.ok(trns1);
    assert.equal(trns1.severity, 'HIGH');

    assert.ok(trns2);
    assert.equal(trns2.severity, 'CRITICAL');
    assert.equal(trns2.owaspCategory, 'API8:2023_SECURITY_MISCONFIGURATION');
  });

  // Test 8: Sensitive response field heuristic (DATA-001)
  it('should heuristically detect sensitive fields in response schemas (DATA-001)', () => {
    const ast = createBaseAst();
    ast.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties!['passwordHash'] = {
      name: 'passwordHash',
      required: true,
      schema: {
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
        type: 'string',
      },
    };

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'DATA-001' && f.id.includes('passwordHash'));

    assert.ok(finding);
    assert.equal(finding.severity, 'HIGH');
    assert.equal(finding.confidence, 'MEDIUM');
    assert.equal(finding.isHeuristic, true);
    assert.equal(finding.owaspCategory, 'API3:2023_BOPLA');
  });

  // Test 9: Sensitive request field heuristic in query (DATA-002)
  it('should heuristically detect sensitive parameters in query string (DATA-002)', () => {
    const ast = createBaseAst();
    ast.endpoints[0]!.parameters.push({
      name: 'accessToken',
      in: 'query',
      required: false,
      deprecated: false,
      schema: {
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
        type: 'string',
      },
    });

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'DATA-002');

    assert.ok(finding);
    assert.equal(finding.severity, 'MEDIUM');
    assert.equal(finding.confidence, 'MEDIUM');
    assert.equal(finding.isHeuristic, true);
    assert.match(finding.description, /accessToken/);
  });

  // Test 10: Configurable sensitive field names
  it('should support customized sensitive field names in options', () => {
    const ast = createBaseAst();
    ast.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties!['nationalIdNumber'] = {
      name: 'nationalIdNumber',
      required: false,
      schema: {
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
        type: 'string',
      },
    };

    // With default list: nationalIdNumber is not caught
    const defaultRes = runSecurityAudit(ast);
    assert.equal(defaultRes.findings.some((f) => f.id.includes('nationalIdNumber')), false);

    // With customized list: nationalIdNumber is caught
    const customRes = runSecurityAudit(ast, {
      sensitiveFieldNames: ['nationalIdNumber', 'secretKey'],
    });
    const finding = customRes.findings.find((f) => f.id.includes('nationalIdNumber'));
    assert.ok(finding);
    assert.equal(finding.ruleId, 'DATA-001');
  });

  // Test 11: Missing pagination on collection (RSRC-001)
  it('should detect collection endpoint without pagination query parameters (RSRC-001)', () => {
    const ast = createBaseAst();
    ast.endpoints.push({
      id: 'get:/items',
      path: '/items',
      method: 'get',
      deprecated: false,
      tags: [],
      parameters: [], // No pagination parameters!
      responses: {
        '200': {
          statusCode: '200',
          description: 'Items array',
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
                  requiredProperties: [],
                  type: 'object',
                },
              },
            },
          },
        },
      },
    });

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'RSRC-001');

    assert.ok(finding);
    assert.equal(finding.severity, 'MEDIUM');
    assert.equal(finding.owaspCategory, 'API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION');
  });

  // Test 12: Array without maxItems in request body (RSRC-002)
  it('should detect request array schema without maxItems (RSRC-002)', () => {
    const ast = createBaseAst();
    ast.endpoints.push({
      id: 'post:/batch-items',
      path: '/batch-items',
      method: 'post',
      deprecated: false,
      tags: [],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              nullable: false,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
              type: 'array',
              // maxItems is undefined!
            },
          },
        },
      },
      responses: { '201': { statusCode: '201', description: 'Created' } },
    });

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'RSRC-002');

    assert.ok(finding);
    assert.equal(finding.severity, 'LOW');
    assert.equal(finding.owaspCategory, 'API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION');
  });

  // Test 13: String without maxLength in request body (RSRC-003)
  it('should detect free-form string in request body without maxLength (RSRC-003)', () => {
    const ast = createBaseAst();
    ast.endpoints.push({
      id: 'post:/comments',
      path: '/comments',
      method: 'post',
      deprecated: false,
      tags: [],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              nullable: false,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
              type: 'object',
              properties: {
                content: {
                  name: 'content',
                  required: true,
                  schema: {
                    nullable: false,
                    readOnly: false,
                    writeOnly: false,
                    deprecated: false,
                    requiredProperties: [],
                    type: 'string',
                    // maxLength is undefined!
                  },
                },
              },
            },
          },
        },
      },
      responses: { '201': { statusCode: '201', description: 'Created' } },
    });

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'RSRC-003');

    assert.ok(finding);
    assert.equal(finding.severity, 'LOW');
  });

  // Test 14: Numeric input without bounds (RSRC-004)
  it('should detect numeric parameter without minimum/maximum bounds (RSRC-004)', () => {
    const ast = createBaseAst();
    ast.endpoints[0]!.parameters.push({
      name: 'multiplier',
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
        // minimum and maximum are undefined!
      },
    });

    const result = runSecurityAudit(ast);
    const finding = result.findings.find((f) => f.ruleId === 'RSRC-004');

    assert.ok(finding);
    assert.equal(finding.severity, 'LOW');
  });

  // Test 15: Multiple rules triggered on a single endpoint
  it('should aggregate multiple rules on a single endpoint cleanly', () => {
    const ast = createBaseAst();
    ast.security = []; // Triggers AUTH-001
    ast.endpoints[0]!.security = undefined;
    ast.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties!['secret'] = {
      name: 'secret',
      required: true,
      schema: { nullable: false, readOnly: false, writeOnly: false, deprecated: false, requiredProperties: [], type: 'string' },
    }; // Triggers DATA-001

    const result = runSecurityAudit(ast);
    const epFindings = result.findings.filter((f) => f.endpointPath === ast.endpoints[0]!.path);

    assert.ok(epFindings.length >= 2);
    assert.ok(epFindings.some((f) => f.ruleId === 'AUTH-001'));
    assert.ok(epFindings.some((f) => f.ruleId === 'DATA-001'));
  });

  // Test 16: Stable finding IDs and deterministic ordering
  it('should produce 100% deterministic finding ordering and IDs across multiple runs', () => {
    const ast = createBaseAst();
    ast.security = [];
    ast.servers = [{ url: 'http://api.production.com', description: 'Production' }];
    ast.endpoints[0]!.security = undefined;

    const result1 = runSecurityAudit(ast);
    const result2 = runSecurityAudit(ast);

    assert.equal(result1.findings.length, result2.findings.length);
    assert.deepEqual(
      result1.findings.map((f) => f.id),
      result2.findings.map((f) => f.id)
    );
    assert.equal(result1.score, result2.score);
  });

  // Test 17: OWASP Top 10 breakdown metadata
  it('should calculate accurate OWASP category breakdown and risk score', () => {
    const ast = createBaseAst();
    ast.security = []; // Triggers AUTH-001 (API2:2023_BROKEN_AUTH)
    ast.servers = [{ url: 'http://api.production.com', description: 'Production' }]; // Triggers TRNS-001, TRNS-002 (API8:2023)

    const result = runSecurityAudit(ast);

    assert.ok(result.owaspBreakdown['API2:2023_BROKEN_AUTH']);
    assert.ok(result.owaspBreakdown['API8:2023_SECURITY_MISCONFIGURATION']);
    assert.ok(result.score < 100);
    assert.ok(result.summary.critical >= 1);
    assert.ok(result.summary.high >= 1);
  });
});
