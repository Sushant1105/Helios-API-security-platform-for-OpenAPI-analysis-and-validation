/**
 * @helios/canonical-ast
 * Comprehensive test suite verifying the Canonical Intermediate Representation (AST):
 * - Invariant enforcement (missing path/method, invalid status code, duplicate endpoint collisions)
 * - Deterministic stable identity generation (method:path)
 * - Path and method normalization
 * - Parameters, request bodies, responses, and security schemes
 * - Object schemas with CanonicalProperty, arrays, enums, polymorphism
 * - Cycle handling and recursion limits
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AstNormalizer,
  buildCanonicalAst,
  normalizeToCanonicalAst,
  type CanonicalApiAst,
} from '../index.js';

describe('Canonical AST Engine (Phase 2)', () => {
  describe('Path and Method Normalization', () => {
    it('should normalize paths with varying slash conventions', () => {
      assert.equal(AstNormalizer.normalizePath('/pets'), '/pets');
      assert.equal(AstNormalizer.normalizePath('/pets/'), '/pets');
      assert.equal(AstNormalizer.normalizePath('pets'), '/pets');
      assert.equal(AstNormalizer.normalizePath('///pets//orders///'), '/pets/orders');
      assert.equal(AstNormalizer.normalizePath('/'), '/');
      assert.equal(AstNormalizer.normalizePath(''), '/');
    });

    it('should normalize HTTP methods to lowercase and reject invalid methods', () => {
      assert.equal(AstNormalizer.normalizeMethod('GET'), 'get');
      assert.equal(AstNormalizer.normalizeMethod('Post'), 'post');
      assert.equal(AstNormalizer.normalizeMethod('DELETE'), 'delete');
      assert.equal(AstNormalizer.normalizeMethod('PATCH'), 'patch');
      assert.equal(AstNormalizer.normalizeMethod('PUT'), 'put');
      assert.equal(AstNormalizer.normalizeMethod('OPTIONS'), 'options');
      assert.equal(AstNormalizer.normalizeMethod('HEAD'), 'head');
      assert.equal(AstNormalizer.normalizeMethod('TRACE'), 'trace');
      assert.equal(AstNormalizer.normalizeMethod('INVALID'), null);
      assert.equal(AstNormalizer.normalizeMethod(''), null);
    });

    it('should generate deterministic endpoint identities', () => {
      const id1 = AstNormalizer.generateEndpointId('get', '/pets');
      const id2 = AstNormalizer.generateEndpointId('post', '/pets');
      const id3 = AstNormalizer.generateEndpointId('get', '/pets/{id}');

      assert.equal(id1, 'get:/pets');
      assert.equal(id2, 'post:/pets');
      assert.equal(id3, 'get:/pets/{id}');
    });

    it('should validate standard 3-digit HTTP status codes, wildcards, and default', () => {
      assert.equal(AstNormalizer.isValidStatusCode('200'), true);
      assert.equal(AstNormalizer.isValidStatusCode('404'), true);
      assert.equal(AstNormalizer.isValidStatusCode('500'), true);
      assert.equal(AstNormalizer.isValidStatusCode('4XX'), true);
      assert.equal(AstNormalizer.isValidStatusCode('5xx'), true);
      assert.equal(AstNormalizer.isValidStatusCode('default'), true);
      assert.equal(AstNormalizer.isValidStatusCode('DEFAULT'), true);

      // Invalid status codes
      assert.equal(AstNormalizer.isValidStatusCode('99'), false);
      assert.equal(AstNormalizer.isValidStatusCode('600'), false);
      assert.equal(AstNormalizer.isValidStatusCode('not-a-code'), false);
      assert.equal(AstNormalizer.isValidStatusCode(''), false);
    });
  });

  describe('AST Invariant Validation', () => {
    it('should reject non-object specification input', () => {
      const res = buildCanonicalAst(null);
      assert.equal(res.success, false);
      if (!res.success) {
        assert.equal(res.error.code, 'MALFORMED_STRUCTURE');
      }

      const res2 = buildCanonicalAst('string-spec');
      assert.equal(res2.success, false);
      if (!res2.success) {
        assert.equal(res2.error.code, 'MALFORMED_STRUCTURE');
      }
    });

    it('should reject specs missing info.title or info.version', () => {
      const noTitle = {
        info: { version: '1.0.0' },
        paths: {},
      };
      const res1 = buildCanonicalAst(noTitle);
      assert.equal(res1.success, false);
      if (!res1.success) {
        assert.equal(res1.error.code, 'INVALID_INVARIANT');
        assert.match(res1.error.message, /title/i);
      }

      const noVersion = {
        info: { title: 'Test API' },
        paths: {},
      };
      const res2 = buildCanonicalAst(noVersion);
      assert.equal(res2.success, false);
      if (!res2.success) {
        assert.equal(res2.error.code, 'INVALID_INVARIANT');
        assert.match(res2.error.message, /version/i);
      }
    });

    it('should reject invalid or unsupported HTTP method in endpoint', () => {
      const spec = {
        info: { title: 'Test API', version: '1.0.0' },
        endpoints: [
          {
            path: '/users',
            method: 'INVALID_VERB',
            responses: { '200': { description: 'OK' } },
          },
        ],
      };
      const res = buildCanonicalAst(spec);
      assert.equal(res.success, false);
      if (!res.success) {
        assert.equal(res.error.code, 'INVALID_INVARIANT');
        assert.match(res.error.message, /invalid or unsupported HTTP method/i);
      }
    });

    it('should reject endpoint missing path', () => {
      const spec = {
        info: { title: 'Test API', version: '1.0.0' },
        endpoints: [
          {
            path: '',
            method: 'get',
            responses: { '200': { description: 'OK' } },
          },
        ],
      };
      const res = buildCanonicalAst(spec);
      assert.equal(res.success, false);
      if (!res.success) {
        assert.equal(res.error.code, 'INVALID_INVARIANT');
        assert.match(res.error.message, /missing required "path"/i);
      }
    });

    it('should reject duplicate endpoint collisions (method + normalized path)', () => {
      const spec = {
        info: { title: 'Colliding API', version: '1.0.0' },
        endpoints: [
          {
            path: '/users',
            method: 'get',
            responses: { '200': { description: 'OK' } },
          },
          {
            path: '/users/', // normalizes to /users -> collision with get:/users
            method: 'GET',
            responses: { '200': { description: 'OK duplicate' } },
          },
        ],
      };
      const res = buildCanonicalAst(spec);
      assert.equal(res.success, false);
      if (!res.success) {
        assert.equal(res.error.code, 'DUPLICATE_ENDPOINT');
        assert.match(res.error.message, /duplicate endpoint identity/i);
      }
    });

    it('should reject invalid response status codes', () => {
      const spec = {
        info: { title: 'Bad Status API', version: '1.0.0' },
        endpoints: [
          {
            path: '/health',
            method: 'get',
            responses: {
              'invalid-code': { description: 'Wrong' },
            },
          },
        ],
      };
      const res = buildCanonicalAst(spec);
      assert.equal(res.success, false);
      if (!res.success) {
        assert.equal(res.error.code, 'INVALID_STATUS_CODE');
        assert.match(res.error.message, /invalid http response status code/i);
      }
    });
  });

  describe('Full Specification Transformation & Normalization', () => {
    it('should build a complete CanonicalApiAst from structured input', () => {
      const rawSpec = {
        specVersion: '3.1',
        rawFormat: 'yaml',
        info: {
          title: 'Helios Core API',
          version: '2.4.0',
          description: 'Production API service',
          contact: { name: 'Helios Team', email: 'dev@helios.local' },
          license: { name: 'Apache-2.0' },
        },
        servers: [
          { url: 'https://api.helios.local/v2', description: 'Production server' },
        ],
        tags: [
          { name: 'Core', description: 'Core system endpoints' },
        ],
        endpoints: [
          {
            path: '/items/{id}/',
            method: 'GET',
            summary: 'Get item by ID',
            description: 'Retrieves item details',
            operationId: 'getItemById',
            deprecated: false,
            tags: ['Core'],
            parameters: [
              // Path param with required: false must be normalized to true
              {
                name: 'id',
                in: 'path',
                required: false,
                description: 'The item ID',
                schema: { type: 'string' },
              },
              {
                name: 'includeDetails',
                in: 'query',
                required: false,
                schema: { type: 'boolean', default: false },
              },
            ],
            responses: {
              '200': {
                description: 'Item retrieved successfully',
                headers: {
                  'X-Request-ID': {
                    description: 'Unique request tracer',
                    required: true,
                    deprecated: false,
                    schema: { type: 'string' },
                  },
                },
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['id', 'name'],
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        tags: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'Item not found',
              },
            },
          },
          {
            path: '/items',
            method: 'POST',
            summary: 'Create item',
            parameters: [],
            requestBody: {
              required: true,
              description: 'Item payload',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                      name: { type: 'string' },
                      price: { type: 'number' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Created successfully',
              },
            },
            security: [
              { name: 'OAuth2Bearer', scopes: ['write:items'] },
            ],
          },
        ],
        schemas: {
          Item: {
            type: 'object',
            required: ['name', 'id'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              status: {
                type: 'string',
                enum: ['active', 'inactive', 'archived'],
              },
            },
          },
        },
        securitySchemes: {
          OAuth2Bearer: {
            type: 'oauth2',
            description: 'OAuth2 Bearer Token',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://auth.helios.local/authorize',
                tokenUrl: 'https://auth.helios.local/token',
              },
            },
          },
          ApiKeyAuth: {
            type: 'apiKey',
            name: 'X-API-KEY',
            in: 'header',
          },
        },
        security: [
          { name: 'ApiKeyAuth', scopes: [] },
        ],
      };

      const result = buildCanonicalAst(rawSpec);
      assert.equal(result.success, true);
      if (!result.success) return;

      const ast: CanonicalApiAst = result.data;

      // Deterministic spec ID
      assert.equal(ast.id, 'helios-core-api:2.4.0');
      assert.equal(ast.title, 'Helios Core API');
      assert.equal(ast.version, '2.4.0');
      assert.equal(ast.specVersion, '3.1');
      assert.equal(ast.format, 'yaml');

      // Servers & Tags
      assert.equal(ast.servers.length, 1);
      assert.equal(ast.servers[0]?.url, 'https://api.helios.local/v2');
      assert.equal(ast.tags.length, 1);
      assert.equal(ast.tags[0]?.name, 'Core');

      // Endpoints normalization
      assert.equal(ast.endpoints.length, 2);

      const getEp = ast.endpoints.find((e) => e.method === 'get');
      assert.ok(getEp);
      assert.equal(getEp.id, 'get:/items/{id}');
      assert.equal(getEp.path, '/items/{id}');
      assert.equal(getEp.operationId, 'getItemById');

      // Parameters normalization
      assert.equal(getEp.parameters.length, 2);
      const pathParam = getEp.parameters.find((p) => p.name === 'id');
      assert.ok(pathParam);
      assert.equal(pathParam.in, 'path');
      assert.equal(pathParam.required, true); // Enforced required: true for path params

      // Response headers & content
      const resp200 = getEp.responses['200'];
      assert.ok(resp200);
      assert.equal(resp200.statusCode, '200');
      assert.ok(resp200.headers?.['X-Request-ID']);
      assert.equal(resp200.headers['X-Request-ID'].required, true);
      assert.ok(resp200.content?.['application/json']);

      // Response Schema
      const respSchema = resp200.content?.['application/json']?.schema;
      assert.ok(respSchema);
      assert.deepEqual(respSchema.requiredProperties, ['id', 'name']);
      assert.ok(respSchema.properties?.['id']);
      assert.equal(respSchema.properties['id'].required, true);
      assert.ok(respSchema.properties?.['name']);
      assert.equal(respSchema.properties['name'].required, true);
      assert.ok(respSchema.properties?.['tags']);
      assert.equal(respSchema.properties['tags'].schema.items?.type, 'string');

      // POST endpoint with requestBody and security
      const postEp = ast.endpoints.find((e) => e.method === 'post');
      assert.ok(postEp);
      assert.equal(postEp.id, 'post:/items');
      assert.ok(postEp.requestBody);
      assert.equal(postEp.requestBody.required, true);
      assert.ok(postEp.requestBody.content['application/json']);
      assert.equal(postEp.security?.length, 1);
      assert.equal(postEp.security[0]?.name, 'OAuth2Bearer');
      assert.deepEqual(postEp.security[0]?.scopes, ['write:items']);

      // Schemas & CanonicalProperty
      assert.ok(ast.schemas['Item']);
      const itemSchema = ast.schemas['Item'];
      assert.deepEqual(itemSchema.requiredProperties, ['id', 'name']);
      assert.ok(itemSchema.properties?.['status']);
      assert.deepEqual(itemSchema.properties['status'].schema.enum, ['active', 'inactive', 'archived']);

      // Security schemes
      assert.ok(ast.securitySchemes['OAuth2Bearer']);
      assert.equal(ast.securitySchemes['OAuth2Bearer'].type, 'oauth2');
      assert.ok(ast.securitySchemes['ApiKeyAuth']);
      assert.equal(ast.securitySchemes['ApiKeyAuth'].type, 'apiKey');
      assert.equal(ast.securitySchemes['ApiKeyAuth'].in, 'header');

      // Global security
      assert.equal(ast.security.length, 1);
      assert.equal(ast.security[0]?.name, 'ApiKeyAuth');

      // Metadata
      assert.equal(ast.metadata.totalEndpoints, 2);
      assert.equal(ast.metadata.totalSchemas, 1);
      assert.equal(ast.metadata.sourceFormat, 'yaml');
    });

    it('should support paths object format parsing directly', () => {
      const docWithPaths = {
        info: { title: 'Raw Paths API', version: '1.0.0' },
        paths: {
          '/status': {
            parameters: [
              { name: 'X-Tenant', in: 'header', required: true },
            ],
            get: {
              summary: 'Get health status',
              responses: {
                '200': { description: 'Healthy' },
                'default': { description: 'Unexpected error' },
              },
            },
            head: {
              summary: 'Check status head',
              responses: {
                '204': { description: 'No content' },
              },
            },
          },
        },
      };

      const result = normalizeToCanonicalAst(docWithPaths);
      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.endpoints.length, 2);
      const getEp = result.data.endpoints.find((e) => e.method === 'get');
      const headEp = result.data.endpoints.find((e) => e.method === 'head');
      assert.ok(getEp);
      assert.ok(headEp);

      // Path-level parameter merged into operations
      assert.equal(getEp.parameters.length, 1);
      assert.equal(getEp.parameters[0]?.name, 'X-Tenant');
      assert.equal(getEp.parameters[0]?.in, 'header');
      assert.equal(getEp.parameters[0]?.required, true);

      // Responses with default status code
      assert.ok(getEp.responses['default']);
      assert.equal(getEp.responses['default'].description, 'Unexpected error');
    });
  });

  describe('Schema Polymorphism, Enums & Cycle Detection', () => {
    it('should handle allOf, anyOf, and oneOf polymorphism', () => {
      const polySpec = {
        info: { title: 'Poly API', version: '1.0.0' },
        schemas: {
          CatOrDog: {
            oneOf: [
              { type: 'object', properties: { meow: { type: 'boolean' } } },
              { type: 'object', properties: { bark: { type: 'boolean' } } },
            ],
          },
          ExtendedUser: {
            allOf: [
              { type: 'object', properties: { id: { type: 'string' } } },
              { type: 'object', properties: { permissions: { type: 'array' } } },
            ],
          },
        },
        endpoints: [],
      };

      const result = buildCanonicalAst(polySpec);
      assert.equal(result.success, true);
      if (!result.success) return;

      const catOrDog = result.data.schemas['CatOrDog'];
      assert.ok(catOrDog);
      assert.equal(catOrDog.oneOf?.length, 2);

      const extendedUser = result.data.schemas['ExtendedUser'];
      assert.ok(extendedUser);
      assert.equal(extendedUser.allOf?.length, 2);
    });

    it('should detect circular references and mark isCircular gracefully', () => {
      const circularNode: Record<string, unknown> = {
        type: 'object',
        rawRef: '#/components/schemas/Node',
      };
      // Self reference
      circularNode.properties = {
        parent: circularNode,
      };

      const spec = {
        info: { title: 'Graph API', version: '1.0.0' },
        schemas: {
          Node: circularNode,
        },
        endpoints: [],
      };

      const result = buildCanonicalAst(spec);
      assert.equal(result.success, true);
      if (!result.success) return;

      const nodeSchema = result.data.schemas['Node'];
      assert.ok(nodeSchema);
      const parentProp = nodeSchema.properties?.['parent'];
      assert.ok(parentProp);
      assert.equal(parentProp.schema.isCircular, true);
    });
  });
});
