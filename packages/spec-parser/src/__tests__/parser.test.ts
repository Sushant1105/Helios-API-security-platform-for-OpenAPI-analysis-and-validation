/**
 * @helios/spec-parser
 * Comprehensive unit test suite for OpenAPI 3.0 & 3.1 parser,
 * error handling, reference resolution, and Canonical AST transformation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseSpec,
  parseSpecSync,
  parseSpecFile,
  detectFormat,
  toCanonicalAst,
} from '../index.js';

describe('OpenAPI Specification Reader (Phase 1)', () => {
  // Test 1: Valid OpenAPI 3.0 JSON
  it('should successfully parse valid OpenAPI 3.0 JSON specification', async () => {
    const jsonSpec = JSON.stringify({
      openapi: '3.0.3',
      info: {
        title: 'Petstore API',
        version: '1.0.0',
        description: 'Sample pet store specification',
      },
      servers: [{ url: 'https://api.petstore.io/v1' }],
      paths: {
        '/pets': {
          get: {
            summary: 'List all pets',
            operationId: 'listPets',
            responses: {
              '200': {
                description: 'A list of pets',
              },
            },
          },
        },
      },
    });

    const result = await parseSpec(jsonSpec);
    assert.equal(result.success, true);
    if (!result.success) return;

    assert.equal(result.data.specVersion, '3.0');
    assert.equal(result.data.format, 'json');
    assert.equal(result.data.info.title, 'Petstore API');
    assert.equal(result.data.servers.length, 1);
    assert.equal(result.data.endpoints.length, 1);
    assert.equal(result.data.endpoints[0]?.method, 'get');
    assert.equal(result.data.endpoints[0]?.path, '/pets');
  });

  // Test 2: Valid OpenAPI 3.1 YAML
  it('should successfully parse valid OpenAPI 3.1 YAML specification', () => {
    const yamlSpec = `
openapi: 3.1.0
info:
  title: Webhook Platform API
  version: 2.1.0
  description: YAML 3.1 platform spec
servers:
  - url: https://api.webhooks.dev
paths:
  /webhooks:
    post:
      summary: Register a webhook
      operationId: createWebhook
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [url]
              properties:
                url:
                  type: string
                  format: uri
      responses:
        '201':
          description: Webhook registered
`;

    const result = parseSpecSync(yamlSpec);
    assert.equal(result.success, true);
    if (!result.success) return;

    assert.equal(result.data.specVersion, '3.1');
    assert.equal(result.data.format, 'yaml');
    assert.equal(result.data.info.title, 'Webhook Platform API');
    assert.equal(result.data.endpoints.length, 1);
    assert.equal(result.data.endpoints[0]?.method, 'post');
    assert.equal(result.data.endpoints[0]?.requestBody?.required, true);
  });

  // Test 3: Missing openapi field
  it('should fail with VALIDATION_ERROR when openapi field is missing', () => {
    const invalidSpec = JSON.stringify({
      info: { title: 'No Version API', version: '1.0.0' },
      paths: {},
    });

    const result = parseSpecSync(invalidSpec);
    assert.equal(result.success, false);
    if (result.success) return;

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.match(result.error.message, /Missing required root property "openapi"/i);
  });

  // Test 4: Missing info field
  it('should fail with VALIDATION_ERROR when info field is missing', () => {
    const invalidSpec = JSON.stringify({
      openapi: '3.0.0',
      paths: {},
    });

    const result = parseSpecSync(invalidSpec);
    assert.equal(result.success, false);
    if (result.success) return;

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.match(result.error.message, /Missing required root property "info"/i);
  });

  // Test 5: Missing paths field
  it('should fail with VALIDATION_ERROR when paths field is missing', () => {
    const invalidSpec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Missing Paths', version: '1.0' },
    });

    const result = parseSpecSync(invalidSpec);
    assert.equal(result.success, false);
    if (result.success) return;

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.match(result.error.message, /Missing required root property "paths"/i);
  });

  // Test 6: Unsupported OpenAPI version (Swagger 2.0 & OpenAPI 4.0)
  it('should fail with UNSUPPORTED_VERSION for Swagger 2.0 specifications', () => {
    const swaggerSpec = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Legacy Swagger', version: '2.0.0' },
      paths: {},
    });

    const result = parseSpecSync(swaggerSpec);
    assert.equal(result.success, false);
    if (result.success) return;

    assert.equal(result.error.code, 'UNSUPPORTED_VERSION');
    assert.match(result.error.message, /OpenAPI 2\.0 \(Swagger\) specifications are not supported/i);
  });

  it('should fail with UNSUPPORTED_VERSION for non-3.0/3.1 versions', () => {
    const futureSpec = JSON.stringify({
      openapi: '4.0.0',
      info: { title: 'Future Spec', version: '4.0.0' },
      paths: {},
    });

    const result = parseSpecSync(futureSpec);
    assert.equal(result.success, false);
    if (result.success) return;

    assert.equal(result.error.code, 'UNSUPPORTED_VERSION');
    assert.match(result.error.message, /Unsupported OpenAPI version "4\.0\.0"/i);
  });

  // Test 7: Invalid YAML syntax
  it('should fail with SYNTAX_ERROR for malformed YAML', () => {
    const malformedYaml = `
openapi: 3.0.0
info:
  title: Malformed Spec
  version: [unclosed list
paths:
  /test:
`;

    const result = parseSpecSync(malformedYaml);
    assert.equal(result.success, false);
    if (result.success) return;

    assert.equal(result.error.code, 'SYNTAX_ERROR');
    assert.match(result.error.message, /Failed to parse YAML/i);
  });

  // Test 8: Invalid JSON syntax
  it('should fail with SYNTAX_ERROR for malformed JSON', () => {
    const malformedJson = '{ "openapi": "3.0.0", "info": { "title": "Broken", } }';

    const result = parseSpecSync(malformedJson);
    assert.equal(result.success, false);
    if (result.success) return;

    assert.equal(result.error.code, 'SYNTAX_ERROR');
  });

  // Test 9: Local $ref resolution
  it('should resolve local $ref pointers (#/components/schemas/...) cleanly', () => {
    const specWithRefs = `
openapi: 3.0.3
info:
  title: Users API
  version: 1.0.0
components:
  schemas:
    Address:
      type: object
      properties:
        city:
          type: string
    User:
      type: object
      properties:
        id:
          type: string
        address:
          $ref: '#/components/schemas/Address'
paths:
  /users/{id}:
    get:
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
`;

    const result = parseSpecSync(specWithRefs);
    assert.equal(result.success, true);
    if (!result.success) return;

    const userSchema = result.data.components.schemas.User;
    assert.ok(userSchema);
    assert.equal(userSchema.type, 'object');
    assert.ok(userSchema.properties?.address);
    assert.equal(userSchema.properties.address.type, 'object');
    assert.ok(userSchema.properties.address.properties?.city);

    // Check endpoint response schema was resolved
    const endpoint = result.data.endpoints[0];
    assert.ok(endpoint);
    const resp200 = endpoint.responses['200'];
    assert.ok(resp200);
    const bodySchema = resp200.content?.['application/json']?.schema;
    assert.ok(bodySchema);
    assert.equal(bodySchema.type, 'object');
  });

  // Test 10: Cyclic $ref handling without infinite recursion
  it('should safely handle cyclic schemas without stack overflow', () => {
    const circularSpec = `
openapi: 3.0.3
info:
  title: Circular Node API
  version: 1.0.0
components:
  schemas:
    TreeNode:
      type: object
      properties:
        value:
          type: string
        parent:
          $ref: '#/components/schemas/TreeNode'
paths:
  /tree:
    get:
      responses:
        '200':
          description: Tree
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TreeNode'
`;

    const result = parseSpecSync(circularSpec);
    assert.equal(result.success, true);
    if (!result.success) return;

    const treeNode = result.data.components.schemas.TreeNode;
    assert.ok(treeNode);
    assert.equal(treeNode.type, 'object');
    // The cyclic reference should be flagged and preserved without blowing the call stack
    const parentProp = treeNode.properties?.parent;
    assert.ok(parentProp);
    assert.equal(parentProp.isCircular, true);
  });

  // Test 11: Multiple endpoints, HTTP methods, and path parameter merging
  it('should extract multiple endpoints and merge path-level parameters', () => {
    const multiEndpointSpec = `
openapi: 3.0.3
info:
  title: Inventory API
  version: 1.0.0
paths:
  /items/{itemId}:
    parameters:
      - name: itemId
        in: path
        required: true
        schema:
          type: string
      - name: X-Trace-Id
        in: header
        required: false
        schema:
          type: string
    get:
      summary: Retrieve item
      responses:
        '200':
          description: Found
    put:
      summary: Update item
      responses:
        '200':
          description: Updated
    delete:
      summary: Remove item
      responses:
        '204':
          description: Deleted
  /items:
    post:
      summary: Create item
      responses:
        '201':
          description: Created
`;

    const result = parseSpecSync(multiEndpointSpec);
    assert.equal(result.success, true);
    if (!result.success) return;

    assert.equal(result.data.endpoints.length, 4);

    const getEndpoint = result.data.endpoints.find(
      (e) => e.path === '/items/{itemId}' && e.method === 'get'
    );
    assert.ok(getEndpoint);
    // Should inherit the path-level parameters: itemId (path) and X-Trace-Id (header)
    assert.equal(getEndpoint.parameters.length, 2);
    assert.ok(getEndpoint.parameters.some((p) => p.name === 'itemId' && p.in === 'path'));
    assert.ok(getEndpoint.parameters.some((p) => p.name === 'X-Trace-Id' && p.in === 'header'));
  });

  // Test 12: parseSpecFile reading from disk
  it('should parse an OpenAPI file from the local filesystem', async () => {
    const tempFilePath = join(tmpdir(), `helios-spec-test-${Date.now()}.json`);
    const content = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'File System API', version: '3.0' },
      paths: { '/ping': { get: { responses: { '200': { description: 'pong' } } } } },
    });

    await writeFile(tempFilePath, content, 'utf-8');

    try {
      const result = await parseSpecFile(tempFilePath);
      assert.equal(result.success, true);
      if (!result.success) return;
      assert.equal(result.data.info.title, 'File System API');
      assert.equal(result.data.endpoints.length, 1);
    } finally {
      await unlink(tempFilePath).catch(() => {});
    }
  });

  // Test 13: toCanonicalAst transformation
  it('should transform ParsedOpenAPISpec into valid HeliosSpec Canonical AST', () => {
    const rawYaml = `
openapi: 3.1.0
info:
  title: Canonical Bridge API
  version: 1.0.0
paths:
  /status:
    get:
      summary: Healthcheck
      responses:
        '200':
          description: Healthy
`;

    const parseRes = parseSpecSync(rawYaml);
    assert.equal(parseRes.success, true);
    if (!parseRes.success) return;

    const ast = toCanonicalAst(parseRes.data);
    assert.equal(ast.specVersion, '3.1');
    assert.equal(ast.rawFormat, 'yaml');
    assert.equal(ast.info.title, 'Canonical Bridge API');
    assert.equal(ast.endpoints.length, 1);
    assert.equal(ast.endpoints[0]?.path, '/status');
    assert.equal(ast.endpoints[0]?.method, 'get');
  });

  // Test 14: detectFormat utility
  it('should accurately detect JSON and YAML formats', () => {
    assert.equal(detectFormat('{"openapi": "3.0.0"}'), 'json');
    assert.equal(detectFormat('openapi: 3.0.0\ninfo:\n  title: Test'), 'yaml');
  });
});
