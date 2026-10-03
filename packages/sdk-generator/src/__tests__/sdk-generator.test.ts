/**
 * @helios/sdk-generator
 * Comprehensive unit test suite covering:
 * - Basic TypeScript generation
 * - Basic Python generation
 * - Nested models and object structures
 * - Arrays of primitives and objects
 * - Enums (TS string literals, Python Enum)
 * - Optional and required properties
 * - Nullable properties
 * - Path, query, and header parameter handling
 * - Request bodies and media types
 * - Multiple response types
 * - Authentication configuration (API keys, Bearer, Basic)
 * - Naming collisions and reserved keywords
 * - Unsupported schema constructs and error handling
 * - 100% deterministic outputs and stable file ordering
 * - Python syntax validation on generated Python files
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import type { CanonicalApiAst } from '@helios/canonical-ast';
import { generateSdk, GenerationError, SdkGenerator } from '../index.js';

function createSampleAst(): CanonicalApiAst {
  return {
    id: 'store-api:1.0.0',
    title: 'Store API',
    version: '1.0.0',
    specVersion: '3.1',
    format: 'yaml',
    info: {
      title: 'Store API',
      version: '1.0.0',
      description: 'E-commerce store specification',
    },
    servers: [{ url: 'https://api.store.example.com/v1', description: 'Production API' }],
    tags: [{ name: 'Products' }],
    endpoints: [
      {
        id: 'get:/products/{id}',
        path: '/products/{id}',
        method: 'get',
        operationId: 'getProductById',
        deprecated: false,
        tags: ['Products'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            deprecated: false,
            schema: {
              type: 'string',
              nullable: false,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
            },
          },
          {
            name: 'includeDetails',
            in: 'query',
            required: false,
            deprecated: false,
            schema: {
              type: 'boolean',
              nullable: true,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
            },
          },
          {
            name: 'X-Client-Id',
            in: 'header',
            required: false,
            deprecated: false,
            schema: {
              type: 'string',
              nullable: false,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
            },
          },
        ],
        responses: {
          '200': {
            statusCode: '200',
            description: 'Product found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  nullable: false,
                  readOnly: false,
                  writeOnly: false,
                  deprecated: false,
                  requiredProperties: ['id', 'title', 'price', 'status'],
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
                    title: {
                      name: 'title',
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
                    price: {
                      name: 'price',
                      required: true,
                      schema: {
                        type: 'number',
                        nullable: false,
                        readOnly: false,
                        writeOnly: false,
                        deprecated: false,
                        requiredProperties: [],
                      },
                    },
                    status: {
                      name: 'status',
                      required: true,
                      schema: {
                        type: 'string',
                        nullable: false,
                        readOnly: false,
                        writeOnly: false,
                        deprecated: false,
                        requiredProperties: [],
                        enum: ['in_stock', 'out_of_stock', 'backorder'],
                      },
                    },
                    tags: {
                      name: 'tags',
                      required: false,
                      schema: {
                        type: 'array',
                        nullable: false,
                        readOnly: false,
                        writeOnly: false,
                        deprecated: false,
                        requiredProperties: [],
                        items: {
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
      },
      {
        id: 'post:/products',
        path: '/products',
        method: 'post',
        operationId: 'createProduct',
        deprecated: false,
        tags: ['Products'],
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
                requiredProperties: ['title', 'price'],
                properties: {
                  title: {
                    name: 'title',
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
                  price: {
                    name: 'price',
                    required: true,
                    schema: {
                      type: 'number',
                      nullable: false,
                      readOnly: false,
                      writeOnly: false,
                      deprecated: false,
                      requiredProperties: [],
                    },
                  },
                  dimensions: {
                    name: 'dimensions',
                    required: false,
                    schema: {
                      type: 'object',
                      nullable: true,
                      readOnly: false,
                      writeOnly: false,
                      deprecated: false,
                      requiredProperties: ['width', 'height'],
                      properties: {
                        width: {
                          name: 'width',
                          required: true,
                          schema: {
                            type: 'number',
                            nullable: false,
                            readOnly: false,
                            writeOnly: false,
                            deprecated: false,
                            requiredProperties: [],
                          },
                        },
                        height: {
                          name: 'height',
                          required: true,
                          schema: {
                            type: 'number',
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
        },
        responses: {
          '201': {
            statusCode: '201',
            description: 'Product created',
          },
        },
      },
      {
        id: 'delete:/products/{id}',
        path: '/products/{id}',
        method: 'delete',
        operationId: 'deleteProduct',
        deprecated: false,
        tags: ['Products'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            deprecated: false,
            schema: {
              type: 'string',
              nullable: false,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
            },
          },
        ],
        responses: {
          '204': {
            statusCode: '204',
            description: 'Product deleted',
          },
        },
      },
    ],
    schemas: {
      Category: {
        id: 'Category',
        type: 'object',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: ['name'],
        properties: {
          id: {
            name: 'id',
            required: false,
            schema: {
              type: 'string',
              nullable: false,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
            },
          },
          name: {
            name: 'name',
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
    securitySchemes: {
      ApiKeyAuth: {
        id: 'ApiKeyAuth',
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
      BearerAuth: {
        id: 'BearerAuth',
        type: 'http',
        scheme: 'bearer',
      },
    },
    security: [{ name: 'BearerAuth', scopes: [] }],
    metadata: {
      normalizedAt: '2026-09-18T00:00:00.000Z',
      sourceFormat: 'yaml',
      specVersion: '3.1',
      totalEndpoints: 3,
      totalSchemas: 1,
    },
  };
}

describe('Polyglot SDK Generator (Phase 7)', () => {
  it('1. should generate a valid TypeScript SDK package structure', () => {
    const ast = createSampleAst();
    const generator = new SdkGenerator();
    const sdk = generator.generate(ast, {
      target: 'typescript',
      packageName: '@store/client',
      packageVersion: '1.2.0',
    });

    assert.equal(sdk.target, 'typescript');
    assert.equal(sdk.packageName, '@store/client');
    assert.equal(sdk.packageVersion, '1.2.0');

    const filePaths = sdk.files.map((f) => f.path);
    assert.ok(filePaths.includes('package.json'));
    assert.ok(filePaths.includes('tsconfig.json'));
    assert.ok(filePaths.includes('README.md'));
    assert.ok(filePaths.includes('src/client.ts'));
    assert.ok(filePaths.includes('src/errors.ts'));
    assert.ok(filePaths.includes('src/index.ts'));
    assert.ok(filePaths.includes('src/types.ts'));

    // Check package.json
    const pkgJsonFile = sdk.files.find((f) => f.path === 'package.json');
    assert.ok(pkgJsonFile);
    const parsedPkg = JSON.parse(pkgJsonFile.content);
    assert.equal(parsedPkg.name, '@store/client');
    assert.equal(parsedPkg.version, '1.2.0');
    assert.equal(parsedPkg.type, 'module');

    // Check tsconfig.json
    const tsconfigFile = sdk.files.find((f) => f.path === 'tsconfig.json');
    assert.ok(tsconfigFile);
    const parsedTsconfig = JSON.parse(tsconfigFile.content);
    assert.equal(parsedTsconfig.compilerOptions.target, 'ES2022');
  });

  it('2. should generate a valid Python SDK package structure', () => {
    const ast = createSampleAst();
    const sdk = generateSdk(ast, {
      target: 'python',
      packageName: 'store_client',
      packageVersion: '1.2.0',
    });

    assert.equal(sdk.target, 'python');
    assert.equal(sdk.packageName, 'store_client');
    assert.equal(sdk.packageVersion, '1.2.0');

    const filePaths = sdk.files.map((f) => f.path);
    assert.ok(filePaths.includes('pyproject.toml'));
    assert.ok(filePaths.includes('README.md'));
    assert.ok(filePaths.includes('store_client/__init__.py'));
    assert.ok(filePaths.includes('store_client/client.py'));
    assert.ok(filePaths.includes('store_client/errors.py'));
    assert.ok(filePaths.includes('store_client/models.py'));

    // Check pyproject.toml
    const pyproject = sdk.files.find((f) => f.path === 'pyproject.toml');
    assert.ok(pyproject);
    assert.ok(pyproject.content.includes('name = "store_client"'));
    assert.ok(pyproject.content.includes('version = "1.2.0"'));
  });

  it('3. should generate nested models in TypeScript and Python', () => {
    const ast = createSampleAst();

    const tsSdk = generateSdk(ast, { target: 'typescript', packageName: 'test-ts' });
    const tsTypes = tsSdk.files.find((f) => f.path === 'src/types.ts')?.content || '';
    assert.ok(tsTypes.includes('export interface CreateProductRequestBodyDimensions {'));
    assert.ok(tsTypes.includes('width: number;'));
    assert.ok(tsTypes.includes('height: number;'));

    const pySdk = generateSdk(ast, { target: 'python', packageName: 'test_py' });
    const pyModels = pySdk.files.find((f) => f.path === 'test_py/models.py')?.content || '';
    assert.ok(pyModels.includes('class CreateProductRequestBodyDimensions:'));
    assert.ok(pyModels.includes('width: float'));
    assert.ok(pyModels.includes('height: float'));
  });

  it('4. should handle arrays of primitives and objects', () => {
    const ast = createSampleAst();

    const tsSdk = generateSdk(ast, { target: 'typescript', packageName: 'test-ts' });
    const tsTypes = tsSdk.files.find((f) => f.path === 'src/types.ts')?.content || '';
    assert.ok(tsTypes.includes('tags?: Array<string>;'));

    const pySdk = generateSdk(ast, { target: 'python', packageName: 'test_py' });
    const pyModels = pySdk.files.find((f) => f.path === 'test_py/models.py')?.content || '';
    assert.ok(pyModels.includes('tags: Optional[List[str]] = None'));
  });

  it('5. should generate enums in TypeScript string unions and Python Enum', () => {
    const ast = createSampleAst();

    const tsSdk = generateSdk(ast, { target: 'typescript', packageName: 'test-ts' });
    const tsTypes = tsSdk.files.find((f) => f.path === 'src/types.ts')?.content || '';
    assert.ok(tsTypes.includes('"in_stock" | "out_of_stock" | "backorder"'));

    const pySdk = generateSdk(ast, { target: 'python', packageName: 'test_py' });
    const pyModels = pySdk.files.find((f) => f.path === 'test_py/models.py')?.content || '';
    assert.ok(pyModels.includes('class GetProductByIdResponseStatus(str, Enum):'));
    assert.ok(pyModels.includes('IN_STOCK = "in_stock"'));
    assert.ok(pyModels.includes('OUT_OF_STOCK = "out_of_stock"'));
  });

  it('6. should correctly reflect optional vs required properties in TypeScript and Python', () => {
    const ast = createSampleAst();

    const tsSdk = generateSdk(ast, { target: 'typescript', packageName: 'test-ts' });
    const tsTypes = tsSdk.files.find((f) => f.path === 'src/types.ts')?.content || '';
    assert.ok(tsTypes.includes('title: string;')); // required
    assert.ok(tsTypes.includes('tags?: Array<string>;')); // optional

    const pySdk = generateSdk(ast, { target: 'python', packageName: 'test_py' });
    const pyModels = pySdk.files.find((f) => f.path === 'test_py/models.py')?.content || '';
    assert.ok(pyModels.includes('title: str')); // required
    assert.ok(pyModels.includes('tags: Optional[List[str]] = None')); // optional
  });

  it('7. should handle nullable properties correctly', () => {
    const ast = createSampleAst();

    const tsSdk = generateSdk(ast, { target: 'typescript', packageName: 'test-ts' });
    const tsTypes = tsSdk.files.find((f) => f.path === 'src/types.ts')?.content || '';
    assert.ok(tsTypes.includes('includeDetails?: boolean | null;'));

    const pySdk = generateSdk(ast, { target: 'python', packageName: 'test_py' });
    const pyClient = pySdk.files.find((f) => f.path === 'test_py/client.py')?.content || '';
    assert.ok(pyClient.includes('include_details: Optional[bool] = None'));
  });

  it('8. should correctly interpolate path, query, and header parameters in client calls', () => {
    const ast = createSampleAst();

    const tsSdk = generateSdk(ast, { target: 'typescript', packageName: 'test-ts' });
    const tsClient = tsSdk.files.find((f) => f.path === 'src/client.ts')?.content || '';
    assert.ok(tsClient.includes("urlPath = urlPath.replace('{id}', encodeURIComponent(String(params.id)));"));
    assert.ok(tsClient.includes("query.append('includeDetails', String(params.includeDetails));"));
    assert.ok(tsClient.includes("customHeaders['X-Client-Id'] = String(params.xClientId);"));

    const pySdk = generateSdk(ast, { target: 'python', packageName: 'test_py' });
    const pyClient = pySdk.files.find((f) => f.path === 'test_py/client.py')?.content || '';
    assert.ok(pyClient.includes('url_path = url_path.replace("{id}", urllib.parse.quote(str(id)))'));
    assert.ok(pyClient.includes('query_dict["includeDetails"] = str(include_details)'));
    assert.ok(pyClient.includes('custom_headers["X-Client-Id"] = str(x_client_id)'));
  });

  it('9. should handle request bodies and JSON payloads', () => {
    const ast = createSampleAst();

    const tsSdk = generateSdk(ast, { target: 'typescript', packageName: 'test-ts' });
    const tsClient = tsSdk.files.find((f) => f.path === 'src/client.ts')?.content || '';
    assert.ok(tsClient.includes("customHeaders['Content-Type'] = 'application/json';"));
    assert.ok(tsClient.includes('body: JSON.stringify(body)'));

    const pySdk = generateSdk(ast, { target: 'python', packageName: 'test_py' });
    const pyClient = pySdk.files.find((f) => f.path === 'test_py/client.py')?.content || '';
    assert.ok(pyClient.includes('custom_headers["Content-Type"] = "application/json"'));
    assert.ok(pyClient.includes('payload = json.dumps(body.__dict__ if hasattr(body, "__dict__") else body).encode("utf-8")'));
  });

  it('10. should handle void responses for HTTP 204 status codes', () => {
    const ast = createSampleAst();

    const tsSdk = generateSdk(ast, { target: 'typescript', packageName: 'test-ts' });
    const tsClient = tsSdk.files.find((f) => f.path === 'src/client.ts')?.content || '';
    assert.ok(tsClient.includes('async deleteProduct(params: Types.DeleteProductParams): Promise<void> {'));

    const pySdk = generateSdk(ast, { target: 'python', packageName: 'test_py' });
    const pyClient = pySdk.files.find((f) => f.path === 'test_py/client.py')?.content || '';
    assert.ok(pyClient.includes('def delete_product(self, id: str) -> None:'));
  });

  it('11. should support authentication configuration without hardcoded secrets', () => {
    const ast = createSampleAst();

    const tsSdk = generateSdk(ast, { target: 'typescript', packageName: 'test-ts' });
    const tsClient = tsSdk.files.find((f) => f.path === 'src/client.ts')?.content || '';
    assert.ok(tsClient.includes("headers['Authorization'] = `Bearer ${this.auth.bearerToken}`;"));
    assert.ok(tsClient.includes("headers['Authorization'] = `Basic ${token}`;"));
    assert.ok(tsClient.includes("headers[headerName] = this.auth.apiKey;"));

    const pySdk = generateSdk(ast, { target: 'python', packageName: 'test_py' });
    const pyClient = pySdk.files.find((f) => f.path === 'test_py/client.py')?.content || '';
    assert.ok(pyClient.includes('headers["Authorization"] = f"Bearer {self.auth.bearer_token}"'));
    assert.ok(pyClient.includes('headers["Authorization"] = f"Basic {enc}"'));
    assert.ok(pyClient.includes('headers[self.auth.api_key_header] = self.auth.api_key'));
  });

  it('12. should handle reserved keyword naming collisions safely', () => {
    const ast = createSampleAst();
    // Add endpoint with reserved keywords as parameters: "from", "class", "default"
    ast.endpoints[0]!.parameters.push({
      name: 'from',
      in: 'query',
      required: false,
      deprecated: false,
      schema: { type: 'string', nullable: false, readOnly: false, writeOnly: false, deprecated: false, requiredProperties: [] },
    });
    ast.endpoints[0]!.parameters.push({
      name: 'class',
      in: 'query',
      required: false,
      deprecated: false,
      schema: { type: 'string', nullable: false, readOnly: false, writeOnly: false, deprecated: false, requiredProperties: [] },
    });

    const tsSdk = generateSdk(ast, { target: 'typescript', packageName: 'test-ts' });
    const tsTypes = tsSdk.files.find((f) => f.path === 'src/types.ts')?.content || '';
    assert.ok(tsTypes.includes('fromParam?: string;'));
    assert.ok(tsTypes.includes('classParam?: string;'));

    const pySdk = generateSdk(ast, { target: 'python', packageName: 'test_py' });
    const pyClient = pySdk.files.find((f) => f.path === 'test_py/client.py')?.content || '';
    assert.ok(pyClient.includes('from_: Optional[str] = None'));
    assert.ok(pyClient.includes('class_: Optional[str] = None'));
  });

  it('13. should reject invalid options with GenerationError', () => {
    const ast = createSampleAst();

    assert.throws(
      () => generateSdk(ast, { target: 'typescript', packageName: '' }),
      (err: unknown) => err instanceof GenerationError && err.code === 'INVALID_PACKAGE_NAME'
    );

    assert.throws(
      () => generateSdk(ast, { target: 'golang' as any, packageName: 'go-sdk' }),
      (err: unknown) => err instanceof GenerationError && err.code === 'UNSUPPORTED_TARGET'
    );
  });

  it('14. should produce 100% deterministic file ordering and file contents', () => {
    const ast = createSampleAst();

    const run1 = generateSdk(ast, { target: 'typescript', packageName: 'test-sdk' });
    const run2 = generateSdk(ast, { target: 'typescript', packageName: 'test-sdk' });

    assert.equal(run1.files.length, run2.files.length);
    for (let i = 0; i < run1.files.length; i++) {
      assert.equal(run1.files[i]!.path, run2.files[i]!.path);
      assert.equal(run1.files[i]!.content, run2.files[i]!.content);
    }
  });

  it('15. should compile and validate Python syntax for generated Python SDK', () => {
    const ast = createSampleAst();
    const pySdk = generateSdk(ast, {
      target: 'python',
      packageName: 'store_client',
      packageVersion: '1.0.0',
    });

    const pythonFiles = pySdk.files.filter((f) => f.path.endsWith('.py'));
    assert.ok(pythonFiles.length >= 4);

    for (const pyFile of pythonFiles) {
      // Use python ast.parse() with stdin to strictly verify Python syntax validity
      assert.doesNotThrow(() => {
        execSync('python -c "import sys, ast; ast.parse(sys.stdin.read())"', {
          input: pyFile.content,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      }, `Python file ${pyFile.path} failed syntax check`);
    }
  });
});
