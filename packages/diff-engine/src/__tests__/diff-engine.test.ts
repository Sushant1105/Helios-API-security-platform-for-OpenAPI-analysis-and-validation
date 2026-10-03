/**
 * @helios/diff-engine
 * Comprehensive unit test suite covering:
 * - Endpoint additions and removals
 * - Parameter additions, removals, required toggles, and type changes
 * - Request body additions, required properties, and removals
 * - Response status codes, property additions, removals, and type changes
 * - Enum additions and removals across request and response contexts
 * - Nullability changes across request and response contexts
 * - Security requirements, schemes, and OAuth scopes
 * - Cyclic schema cycle protection
 * - Multiple simultaneous changes
 * - Deterministic ordering and stable IDs
 * - Configuration overrides
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalApiAst, CanonicalSchema } from '@helios/canonical-ast';
import { DiffEngine, diffAsts } from '../index.js';

function createBaseAst(): CanonicalApiAst {
  return {
    id: 'api-spec:1.0.0',
    title: 'Test API',
    version: '1.0.0',
    specVersion: '3.1',
    format: 'yaml',
    info: {
      title: 'Test API',
      version: '1.0.0',
      description: 'Base test API',
    },
    servers: [{ url: 'https://api.example.com/v1', description: 'Production server' }],
    tags: [{ name: 'Users' }],
    endpoints: [
      {
        id: 'get:/users/{id}',
        path: '/users/{id}',
        method: 'get',
        operationId: 'getUserById',
        deprecated: false,
        tags: ['Users'],
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
                  type: 'object',
                  nullable: false,
                  readOnly: false,
                  writeOnly: false,
                  deprecated: false,
                  requiredProperties: ['id', 'email'],
                  properties: {
                    id: {
                      name: 'id',
                      required: true,
                      schema: {
                        type: 'string',
                        nullable: false,
                        readOnly: true,
                        writeOnly: false,
                        deprecated: false,
                        requiredProperties: [],
                      },
                    },
                    email: {
                      name: 'email',
                      required: true,
                      schema: {
                        type: 'string',
                        nullable: false,
                        readOnly: false,
                        writeOnly: false,
                        deprecated: false,
                        requiredProperties: [],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        id: 'post:/users',
        path: '/users',
        method: 'post',
        operationId: 'createUser',
        deprecated: false,
        tags: ['Users'],
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                nullable: false,
                readOnly: false,
                writeOnly: false,
                deprecated: false,
                requiredProperties: ['username', 'role'],
                properties: {
                  username: {
                    name: 'username',
                    required: true,
                    schema: {
                      type: 'string',
                      nullable: false,
                      readOnly: false,
                      writeOnly: false,
                      deprecated: false,
                      requiredProperties: [],
                      maxLength: 50,
                    },
                  },
                  role: {
                    name: 'role',
                    required: true,
                    schema: {
                      type: 'string',
                      nullable: false,
                      readOnly: false,
                      writeOnly: false,
                      deprecated: false,
                      requiredProperties: [],
                      enum: ['user', 'admin'],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            statusCode: '201',
            description: 'User created',
          },
        },
      },
    ],
    schemas: {},
    securitySchemes: {
      bearerAuth: {
        id: 'bearerAuth',
        type: 'http',
        scheme: 'bearer',
      },
    },
    security: [{ name: 'bearerAuth', scopes: [] }],
    metadata: {
      normalizedAt: '2026-09-18T00:00:00.000Z',
      sourceFormat: 'yaml',
      specVersion: '3.1',
      totalEndpoints: 2,
      totalSchemas: 0,
    },
  };
}

describe('Semantic API Diff Engine (Phase 6)', () => {
  it('1. should detect added endpoint with non_breaking compatibility', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    target.endpoints.push({
      id: 'get:/health',
      path: '/health',
      method: 'get',
      operationId: 'getHealth',
      deprecated: false,
      tags: [],
      parameters: [],
      responses: {
        '200': { statusCode: '200', description: 'Healthy' },
      },
    });

    const diff = diffAsts(base, target);

    assert.equal(diff.hasBreakingChanges, false);
    const addedEp = diff.changes.find((c) => c.kind === 'ENDPOINT_ADDED');
    assert.ok(addedEp);
    assert.equal(addedEp.compatibility, 'non_breaking');
    assert.equal(addedEp.path, '/health');
    assert.equal(addedEp.method, 'get');
  });

  it('2. should detect removed endpoint with breaking compatibility', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    target.endpoints = target.endpoints.filter((e) => e.path !== '/users/{id}');

    const diff = diffAsts(base, target);

    assert.equal(diff.hasBreakingChanges, true);
    const removedEp = diff.changes.find((c) => c.kind === 'ENDPOINT_REMOVED');
    assert.ok(removedEp);
    assert.equal(removedEp.compatibility, 'breaking');
    assert.equal(removedEp.path, '/users/{id}');
  });

  it('3. should detect added required parameter as breaking, and optional parameter as non_breaking', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    target.endpoints[0]!.parameters.push({
      name: 'filter',
      in: 'query',
      required: false,
      deprecated: false,
    });
    target.endpoints[0]!.parameters.push({
      name: 'token',
      in: 'header',
      required: true,
      deprecated: false,
    });

    const diff = diffAsts(base, target);

    const filterParam = diff.changes.find((c) => c.id.includes('filter'));
    const tokenParam = diff.changes.find((c) => c.id.includes('token'));

    assert.ok(filterParam);
    assert.equal(filterParam.compatibility, 'non_breaking');

    assert.ok(tokenParam);
    assert.equal(tokenParam.compatibility, 'breaking');
    assert.equal(diff.hasBreakingChanges, true);
  });

  it('4. should detect removed parameter as non_breaking', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    target.endpoints[0]!.parameters = [];

    const diff = diffAsts(base, target);
    const removedParam = diff.changes.find((c) => c.kind === 'PARAMETER_REMOVED');
    assert.ok(removedParam);
    assert.equal(removedParam.compatibility, 'non_breaking');
  });

  it('5. should detect parameter type change as breaking', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    target.endpoints[0]!.parameters[0]!.schema = {
      type: 'integer',
      nullable: false,
      readOnly: false,
      writeOnly: false,
      deprecated: false,
      requiredProperties: [],
    };

    const diff = diffAsts(base, target);
    const typeChange = diff.changes.find((c) => c.kind === 'SCHEMA_TYPE_CHANGED');
    assert.ok(typeChange);
    assert.equal(typeChange.compatibility, 'breaking');
  });

  it('6. should detect request property made required as breaking', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    // In base, add an optional property "nickname"
    base.endpoints[1]!.requestBody!.content['application/json']!.schema!.properties!['nickname'] = {
      name: 'nickname',
      required: false,
      schema: {
        type: 'string',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
      },
    };

    // In target, make "nickname" required
    target.endpoints[1]!.requestBody!.content['application/json']!.schema!.properties!['nickname'] = {
      name: 'nickname',
      required: true,
      schema: {
        type: 'string',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
      },
    };
    target.endpoints[1]!.requestBody!.content['application/json']!.schema!.requiredProperties.push(
      'nickname'
    );

    const diff = diffAsts(base, target);
    const reqChange = diff.changes.find((c) => c.kind === 'SCHEMA_PROPERTY_REQUIRED_CHANGED');
    assert.ok(reqChange);
    assert.equal(reqChange.compatibility, 'breaking');
  });

  it('7. should detect request property removed as breaking', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    delete target.endpoints[1]!.requestBody!.content['application/json']!.schema!.properties!['role'];

    const diff = diffAsts(base, target);
    const propRemoved = diff.changes.find((c) => c.kind === 'SCHEMA_PROPERTY_REMOVED');
    assert.ok(propRemoved);
    assert.equal(propRemoved.compatibility, 'breaking');
  });

  it('8. should detect optional response property added as non_breaking', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    target.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'avatarUrl'
    ] = {
      name: 'avatarUrl',
      required: false,
      schema: {
        type: 'string',
        nullable: true,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
      },
    };

    const diff = diffAsts(base, target);
    const propAdded = diff.changes.find((c) => c.kind === 'SCHEMA_PROPERTY_ADDED');
    assert.ok(propAdded);
    assert.equal(propAdded.compatibility, 'non_breaking');
  });

  it('9. should detect response property removed as breaking by default', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    delete target.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'email'
    ];

    const diff = diffAsts(base, target);
    const propRemoved = diff.changes.find(
      (c) => c.kind === 'SCHEMA_PROPERTY_REMOVED' && c.location?.includes('email')
    );
    assert.ok(propRemoved);
    assert.equal(propRemoved.compatibility, 'breaking');
  });

  it('10. should detect response type change as breaking', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    target.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'email'
    ]!.schema = {
      type: 'integer',
      nullable: false,
      readOnly: false,
      writeOnly: false,
      deprecated: false,
      requiredProperties: [],
    };

    const diff = diffAsts(base, target);
    const typeChange = diff.changes.find(
      (c) => c.kind === 'SCHEMA_TYPE_CHANGED' && c.location?.includes('email')
    );
    assert.ok(typeChange);
    assert.equal(typeChange.compatibility, 'breaking');
  });

  it('11. should detect enum value removed as breaking in request, but non_breaking in response', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    // 1. Remove enum from request: ['user', 'admin'] -> ['user']
    target.endpoints[1]!.requestBody!.content['application/json']!.schema!.properties![
      'role'
    ]!.schema.enum = ['user'];

    // 2. Add response enum to base: ['active', 'inactive'] -> target removes 'inactive'
    base.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'status'
    ] = {
      name: 'status',
      required: false,
      schema: {
        type: 'string',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
        enum: ['active', 'inactive'],
      },
    };
    target.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'status'
    ] = {
      name: 'status',
      required: false,
      schema: {
        type: 'string',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
        enum: ['active'],
      },
    };

    const diff = diffAsts(base, target);

    const reqEnumChange = diff.changes.find(
      (c) => c.kind === 'SCHEMA_ENUM_CHANGED' && c.location?.includes('role')
    );
    assert.ok(reqEnumChange);
    assert.equal(reqEnumChange.compatibility, 'breaking');

    const respEnumChange = diff.changes.find(
      (c) => c.kind === 'SCHEMA_ENUM_CHANGED' && c.location?.includes('status')
    );
    assert.ok(respEnumChange);
    assert.equal(respEnumChange.compatibility, 'non_breaking');
  });

  it('12. should detect enum value added as non_breaking in request, but potentially_breaking in response', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    // 1. Add enum to request: ['user', 'admin'] -> ['user', 'admin', 'moderator']
    target.endpoints[1]!.requestBody!.content['application/json']!.schema!.properties![
      'role'
    ]!.schema.enum = ['user', 'admin', 'moderator'];

    // 2. Response enum added:
    base.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'tier'
    ] = {
      name: 'tier',
      required: false,
      schema: {
        type: 'string',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
        enum: ['free', 'premium'],
      },
    };
    target.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'tier'
    ] = {
      name: 'tier',
      required: false,
      schema: {
        type: 'string',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
        enum: ['free', 'premium', 'enterprise'],
      },
    };

    const diff = diffAsts(base, target);

    const reqEnumAdd = diff.changes.find(
      (c) => c.kind === 'SCHEMA_ENUM_CHANGED' && c.location?.includes('role')
    );
    assert.ok(reqEnumAdd);
    assert.equal(reqEnumAdd.compatibility, 'non_breaking');

    const respEnumAdd = diff.changes.find(
      (c) => c.kind === 'SCHEMA_ENUM_CHANGED' && c.location?.includes('tier')
    );
    assert.ok(respEnumAdd);
    assert.equal(respEnumAdd.compatibility, 'potentially_breaking');
  });

  it('13. should detect nullable changes correctly between request and response', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    // Request: nullable true -> false is breaking (can no longer send null)
    base.endpoints[1]!.requestBody!.content['application/json']!.schema!.properties![
      'username'
    ]!.schema.nullable = true;
    target.endpoints[1]!.requestBody!.content['application/json']!.schema!.properties![
      'username'
    ]!.schema.nullable = false;

    // Response: nullable false -> true is potentially_breaking (clients may not handle null)
    base.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'email'
    ]!.schema.nullable = false;
    target.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'email'
    ]!.schema.nullable = true;

    const diff = diffAsts(base, target);

    const reqNullable = diff.changes.find(
      (c) => c.kind === 'SCHEMA_NULLABLE_CHANGED' && c.location?.includes('username')
    );
    assert.ok(reqNullable);
    assert.equal(reqNullable.compatibility, 'breaking');

    const respNullable = diff.changes.find(
      (c) => c.kind === 'SCHEMA_NULLABLE_CHANGED' && c.location?.includes('email')
    );
    assert.ok(respNullable);
    assert.equal(respNullable.compatibility, 'potentially_breaking');
  });

  it('14. should detect security requirement added as potentially_breaking and isSecurityRelevant', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    // Endpoint was unauthenticated in base (empty security)
    base.endpoints[0]!.security = [];
    target.endpoints[0]!.security = [{ name: 'bearerAuth', scopes: [] }];

    const diff = diffAsts(base, target);
    const secAdded = diff.changes.find((c) => c.kind === 'SECURITY_REQUIREMENT_ADDED');
    assert.ok(secAdded);
    assert.equal(secAdded.compatibility, 'potentially_breaking');
    assert.equal(secAdded.isSecurityRelevant, true);
  });

  it('15. should detect security requirement removed with isSecurityRelevant flag', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    base.endpoints[0]!.security = [{ name: 'bearerAuth', scopes: [] }];
    target.endpoints[0]!.security = [];

    const diff = diffAsts(base, target);
    const secRemoved = diff.changes.find((c) => c.kind === 'SECURITY_REQUIREMENT_REMOVED');
    assert.ok(secRemoved);
    assert.equal(secRemoved.isSecurityRelevant, true);
  });

  it('16. should safely handle recursive and circular schemas without stack overflow', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    // Construct circular schema: Node -> Node
    const baseNodeSchema: CanonicalSchema = {
      id: 'Node',
      type: 'object',
      nullable: false,
      readOnly: false,
      writeOnly: false,
      deprecated: false,
      requiredProperties: ['val'],
      properties: {},
    };
    baseNodeSchema.properties!['val'] = {
      name: 'val',
      required: true,
      schema: {
        type: 'string',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
      },
    };
    baseNodeSchema.properties!['next'] = {
      name: 'next',
      required: false,
      schema: baseNodeSchema, // Self loop
    };

    const targetNodeSchema: CanonicalSchema = {
      id: 'Node',
      type: 'object',
      nullable: false,
      readOnly: false,
      writeOnly: false,
      deprecated: false,
      requiredProperties: ['val', 'extra'],
      properties: {},
    };
    targetNodeSchema.properties!['val'] = {
      name: 'val',
      required: true,
      schema: {
        type: 'string',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
      },
    };
    targetNodeSchema.properties!['extra'] = {
      name: 'extra',
      required: false,
      schema: {
        type: 'boolean',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
      },
    };
    targetNodeSchema.properties!['next'] = {
      name: 'next',
      required: false,
      schema: targetNodeSchema, // Self loop
    };

    base.schemas['Node'] = baseNodeSchema;
    target.schemas['Node'] = targetNodeSchema;

    // Should complete cleanly without Maximum call stack size exceeded
    const diff = diffAsts(base, target);
    assert.ok(diff.summary.totalChanges > 0);
    const extraPropAdded = diff.changes.find((c) => c.location?.includes('extra'));
    assert.ok(extraPropAdded);
  });

  it('17. should handle multiple simultaneous changes across metadata, endpoints, parameters, and schemas', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    target.info.title = 'Updated Title';
    target.info.version = '2.0.0';
    target.endpoints[0]!.deprecated = true;
    target.endpoints[1]!.requestBody!.required = false;

    const diff = diffAsts(base, target);

    assert.ok(diff.summary.totalChanges >= 4);
    assert.equal(diff.summary.byCategory.metadata, 2);
    assert.equal(diff.summary.byCategory.endpoint, 1);
    assert.equal(diff.summary.byCategory.request_body, 1);
  });

  it('18. should produce 100% deterministic change ordering and stable IDs across multiple runs', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    target.info.title = 'Updated API';
    target.endpoints[0]!.deprecated = true;
    delete target.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'email'
    ];
    target.endpoints[1]!.parameters.push({
      name: 'apiKey',
      in: 'header',
      required: true,
      deprecated: false,
    });

    const run1 = diffAsts(base, target);
    const run2 = diffAsts(base, target);

    assert.deepEqual(
      run1.changes.map((c) => c.id),
      run2.changes.map((c) => c.id)
    );
    assert.deepEqual(run1.summary, run2.summary);
    assert.equal(run1.hasBreakingChanges, run2.hasBreakingChanges);
  });

  it('19. should respect configuration overrides (e.g., responsePropertyRemovalImpact: potentially_breaking)', () => {
    const base = createBaseAst();
    const target = createBaseAst();

    delete target.endpoints[0]!.responses['200']!.content!['application/json']!.schema!.properties![
      'email'
    ];

    // Default: breaking
    const defaultDiff = diffAsts(base, target);
    const defaultChange = defaultDiff.changes.find(
      (c) => c.kind === 'SCHEMA_PROPERTY_REMOVED' && c.location?.includes('email')
    );
    assert.equal(defaultChange?.compatibility, 'breaking');

    // Override via DiffEngine instance: potentially_breaking
    const engine = new DiffEngine({
      responsePropertyRemovalImpact: 'potentially_breaking',
    });
    const customDiff = engine.compare(base, target);
    const customChange = customDiff.changes.find(
      (c) => c.kind === 'SCHEMA_PROPERTY_REMOVED' && c.location?.includes('email')
    );
    assert.equal(customChange?.compatibility, 'potentially_breaking');
  });
});
