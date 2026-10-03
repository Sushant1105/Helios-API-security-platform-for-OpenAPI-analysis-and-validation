/**
 * @helios/sdk-generator
 * TypeScript Client SDK Generator.
 * Generates an end-to-end, typed, modern fetch-based client SDK package.
 */

import type {
  CanonicalApiAst,
  CanonicalEndpoint,
  CanonicalProperty,
  CanonicalSchema,
} from '@helios/canonical-ast';
import {
  generateMethodName,
  sanitizeTsIdentifier,
  toCamelCase,
  toPascalCase,
  UniqueNameRegistry,
} from '../naming.js';
import type { GeneratedFile, GeneratedSdk, GeneratorOptions, GenerationWarning } from '../types.js';

function resolveSchemaTypeName(
  schema: CanonicalSchema | undefined,
  fallbackName: string,
  modelRegistry: Map<string, string>,
  declaredModels: Map<string, string>
): string {
  if (!schema) return 'unknown';

  if (schema.rawRef) {
    const parts = schema.rawRef.split('/');
    const rawTarget = parts[parts.length - 1] || 'Model';
    return toPascalCase(rawTarget);
  }

  if (schema.id) {
    return toPascalCase(schema.id);
  }

  // Handle enums
  if (schema.enum && schema.enum.length > 0) {
    const variants = schema.enum.map((v) => JSON.stringify(v)).join(' | ');
    return schema.nullable ? `(${variants}) | null` : variants;
  }

  // Handle primitives
  const rawType = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (rawType) {
    case 'string':
      return schema.nullable ? 'string | null' : 'string';
    case 'integer':
    case 'number':
      return schema.nullable ? 'number | null' : 'number';
    case 'boolean':
      return schema.nullable ? 'boolean | null' : 'boolean';
    case 'array': {
      const itemType = schema.items
        ? resolveSchemaTypeName(schema.items, `${fallbackName}Item`, modelRegistry, declaredModels)
        : 'unknown';
      return schema.nullable ? `Array<${itemType}> | null` : `Array<${itemType}>`;
    }
    case 'object': {
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        // Generate an inline or named child model
        const modelName = toPascalCase(fallbackName);
        if (!declaredModels.has(modelName)) {
          generateModelInterface(modelName, schema, modelRegistry, declaredModels);
        }
        return schema.nullable ? `${modelName} | null` : modelName;
      }
      if (schema.additionalProperties) {
        return schema.nullable ? 'Record<string, unknown> | null' : 'Record<string, unknown>';
      }
      return schema.nullable ? 'Record<string, unknown> | null' : 'Record<string, unknown>';
    }
    default:
      if (schema.oneOf && schema.oneOf.length > 0) {
        const union = schema.oneOf
          .map((sub, i) => resolveSchemaTypeName(sub, `${fallbackName}Variant${i}`, modelRegistry, declaredModels))
          .join(' | ');
        return schema.nullable ? `(${union}) | null` : union;
      }
      return 'unknown';
  }
}

function generateModelInterface(
  modelName: string,
  schema: CanonicalSchema,
  modelRegistry: Map<string, string>,
  declaredModels: Map<string, string>
): void {
  const lines: string[] = [];
  if (schema.description) {
    lines.push(`/**\n * ${schema.description.trim().replace(/\n/g, '\n * ')}\n */`);
  }
  lines.push(`export interface ${modelName} {`);

  const props = schema.properties || {};
  const propKeys = Object.keys(props).sort();
  const requiredProps = new Set(schema.requiredProperties || []);

  for (const key of propKeys) {
    const prop: CanonicalProperty | undefined = props[key];
    if (!prop) continue;
    const isRequired = requiredProps.has(key) || prop.required;
    const tsIdentifier = sanitizeTsIdentifier(toCamelCase(key));
    const propType = resolveSchemaTypeName(
      prop.schema,
      `${modelName}${toPascalCase(key)}`,
      modelRegistry,
      declaredModels
    );

    if (prop.description) {
      lines.push(`  /** ${prop.description} */`);
    }
    lines.push(`  ${tsIdentifier}${isRequired ? '' : '?'}: ${propType};`);
  }

  lines.push('}');
  declaredModels.set(modelName, lines.join('\n'));
}

export function generateTypeScriptSdk(
  ast: CanonicalApiAst,
  options: Required<GeneratorOptions>
): GeneratedSdk {
  const warnings: GenerationWarning[] = [];
  const files: GeneratedFile[] = [];

  const clientClassName = options.clientClassName || 'ApiClient';
  const defaultBaseUrl =
    options.baseUrl ||
    (ast.servers && ast.servers.length > 0 && ast.servers[0]?.url ? ast.servers[0].url : 'https://api.example.com');

  const modelRegistry = new Map<string, string>();
  const declaredModels = new Map<string, string>();

  // 1. Process component schemas
  const componentSchemaNames = Object.keys(ast.schemas || {}).sort();
  for (const name of componentSchemaNames) {
    const schema = ast.schemas[name];
    if (schema) {
      const modelName = toPascalCase(name);
      generateModelInterface(modelName, schema, modelRegistry, declaredModels);
    }
  }

  // 2. Collect endpoint parameters & payload types
  interface EndpointMeta {
    endpoint: CanonicalEndpoint;
    methodName: string;
    paramsTypeName?: string;
    bodyTypeName?: string;
    responseTypeName: string;
    hasParams: boolean;
    hasBody: boolean;
  }

  const endpointMetas: EndpointMeta[] = [];
  const methodNameRegistry = new UniqueNameRegistry();

  const sortedEndpoints = ast.endpoints.slice().sort((a, b) => {
    const pathCmp = a.path.localeCompare(b.path);
    if (pathCmp !== 0) return pathCmp;
    return a.method.localeCompare(b.method);
  });

  for (const ep of sortedEndpoints) {
    const baseMethodName = generateMethodName(ep.method, ep.path, ep.operationId, 'typescript');
    const methodName = methodNameRegistry.getUniqueName(baseMethodName);
    const opPrefix = toPascalCase(methodName);

    // Params type
    let paramsTypeName: string | undefined;
    const hasParams = ep.parameters && ep.parameters.length > 0;
    if (hasParams) {
      paramsTypeName = `${opPrefix}Params`;
      const paramLines: string[] = [];
      paramLines.push(`export interface ${paramsTypeName} {`);

      const sortedParams = ep.parameters.slice().sort((a, b) => a.name.localeCompare(b.name));
      for (const param of sortedParams) {
        const paramId = sanitizeTsIdentifier(toCamelCase(param.name));
        const paramType = resolveSchemaTypeName(
          param.schema,
          `${opPrefix}${toPascalCase(param.name)}`,
          modelRegistry,
          declaredModels
        );
        if (param.description) {
          paramLines.push(`  /** ${param.description} (in: ${param.in}) */`);
        }
        paramLines.push(`  ${paramId}${param.required ? '' : '?'}: ${paramType};`);
      }
      paramLines.push('}');
      declaredModels.set(paramsTypeName, paramLines.join('\n'));
    }

    // Body type
    let bodyTypeName: string | undefined;
    const hasBody = !!ep.requestBody && !!ep.requestBody.content;
    if (hasBody) {
      const jsonContent = ep.requestBody!.content['application/json'];
      if (jsonContent?.schema) {
        bodyTypeName = resolveSchemaTypeName(
          jsonContent.schema,
          `${opPrefix}RequestBody`,
          modelRegistry,
          declaredModels
        );
      } else {
        bodyTypeName = 'unknown';
      }
    }

    // Response type
    let responseTypeName = 'void';
    const successResp =
      ep.responses['200'] || ep.responses['201'] || ep.responses['202'] || ep.responses['default'];
    if (successResp?.content?.['application/json']?.schema) {
      responseTypeName = resolveSchemaTypeName(
        successResp.content['application/json'].schema,
        `${opPrefix}Response`,
        modelRegistry,
        declaredModels
      );
    } else if (successResp?.statusCode === '204') {
      responseTypeName = 'void';
    }

    endpointMetas.push({
      endpoint: ep,
      methodName,
      paramsTypeName,
      bodyTypeName,
      responseTypeName,
      hasParams,
      hasBody,
    });
  }

  // --- FILE: src/types.ts ---
  const typesFileContent: string[] = [
    '/**',
    ' * Auto-generated by HELIOS Polyglot SDK Generator.',
    ' * Specification Models, Types, and Client Configurations.',
    ' */',
    '',
    'export interface ClientAuthConfig {',
    '  apiKey?: string;',
    '  apiKeyHeader?: string;',
    '  bearerToken?: string;',
    '  basicAuth?: { username: string; password: string };',
    '  oauth2?: { accessToken?: string; tokenEndpoint?: string; clientId?: string; clientSecret?: string };',
    '}',
    '',
    'export interface ClientOptions {',
    '  baseUrl?: string;',
    '  headers?: Record<string, string>;',
    '  auth?: ClientAuthConfig;',
    '  fetch?: typeof fetch;',
    '}',
    '',
  ];

  const sortedModelKeys = Array.from(declaredModels.keys()).sort();
  for (const modelKey of sortedModelKeys) {
    typesFileContent.push(declaredModels.get(modelKey)!);
    typesFileContent.push('');
  }

  files.push({
    path: 'src/types.ts',
    content: typesFileContent.join('\n').trim() + '\n',
  });

  // --- FILE: src/errors.ts ---
  const errorsFileContent = `/**
 * Auto-generated by HELIOS Polyglot SDK Generator.
 * Typed SDK Exception Hierarchy.
 */

export class ApiException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: unknown
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

export class ApiHttpError extends ApiException {
  constructor(statusCode: number, responseBody: unknown, message = \`HTTP \${statusCode} Error\`) {
    super(message, statusCode, responseBody);
    this.name = 'ApiHttpError';
  }
}

export class ApiValidationError extends ApiException {
  constructor(message: string, public readonly errors?: unknown) {
    super(message, 400, errors);
    this.name = 'ApiValidationError';
  }
}
`;
  files.push({
    path: 'src/errors.ts',
    content: errorsFileContent,
  });

  // --- FILE: src/client.ts ---
  const clientLines: string[] = [
    '/**',
    ' * Auto-generated by HELIOS Polyglot SDK Generator.',
    ' * Primary API Client Implementation.',
    ' */',
    '',
    "import { ApiHttpError, ApiException } from './errors.js';",
    "import type { ClientOptions, ClientAuthConfig } from './types.js';",
    "import * as Types from './types.js';",
    '',
    `export class ${clientClassName} {`,
    '  private readonly baseUrl: string;',
    '  private readonly headers: Record<string, string>;',
    '  private readonly auth?: ClientAuthConfig;',
    '  private readonly fetcher: typeof fetch;',
    '',
    '  constructor(options: ClientOptions = {}) {',
    `    this.baseUrl = (options.baseUrl || '${defaultBaseUrl}').replace(/\\/+$/, '');`,
    '    this.headers = { ...(options.headers || {}) };',
    '    this.auth = options.auth;',
    '    this.fetcher = options.fetch || globalThis.fetch;',
    '  }',
    '',
    '  private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {',
    '    const headers: Record<string, string> = { ...this.headers, ...(customHeaders || {}) };',
    '    if (this.auth?.bearerToken) {',
    "      headers['Authorization'] = `Bearer ${this.auth.bearerToken}`;",
    '    } else if (this.auth?.basicAuth) {',
    '      const token = btoa(`${this.auth.basicAuth.username}:${this.auth.basicAuth.password}`);',
    "      headers['Authorization'] = `Basic ${token}`;",
    '    } else if (this.auth?.apiKey) {',
    "      const headerName = this.auth.apiKeyHeader || 'X-API-Key';",
    '      headers[headerName] = this.auth.apiKey;',
    '    } else if (this.auth?.oauth2?.accessToken) {',
    "      headers['Authorization'] = `Bearer ${this.auth.oauth2.accessToken}`;",
    '    }',
    '    return headers;',
    '  }',
  ];

  for (const meta of endpointMetas) {
    const { endpoint, methodName, paramsTypeName, bodyTypeName, responseTypeName, hasParams, hasBody } = meta;
    const methodUpper = endpoint.method.toUpperCase();

    clientLines.push('');
    if (endpoint.summary || endpoint.description) {
      clientLines.push('  /**');
      if (endpoint.summary) clientLines.push(`   * ${endpoint.summary}`);
      if (endpoint.description) clientLines.push(`   * ${endpoint.description}`);
      clientLines.push('   */');
    }

    // Argument list
    const args: string[] = [];
    if (hasParams && paramsTypeName) {
      args.push(`params: Types.${paramsTypeName}`);
    }
    if (hasBody && bodyTypeName) {
      args.push(`body: Types.${bodyTypeName}`);
    }

    const retType =
      responseTypeName === 'void'
        ? 'void'
        : responseTypeName === 'unknown'
        ? 'unknown'
        : `Types.${responseTypeName}`;
    clientLines.push(`  async ${methodName}(${args.join(', ')}): Promise<${retType}> {`);

    // Path interpolation
    clientLines.push(`    let urlPath = '${endpoint.path}';`);
    const pathParams = (endpoint.parameters || []).filter((p) => p.in === 'path');
    for (const p of pathParams) {
      const id = sanitizeTsIdentifier(toCamelCase(p.name));
      clientLines.push(`    urlPath = urlPath.replace('{${p.name}}', encodeURIComponent(String(params.${id})));`);
    }

    // Query parameters
    const queryParams = (endpoint.parameters || []).filter((p) => p.in === 'query');
    if (queryParams.length > 0) {
      clientLines.push('    const query = new URLSearchParams();');
      for (const qp of queryParams) {
        const id = sanitizeTsIdentifier(toCamelCase(qp.name));
        clientLines.push(`    if (params.${id} !== undefined && params.${id} !== null) {`);
        clientLines.push(`      query.append('${qp.name}', String(params.${id}));`);
        clientLines.push('    }');
      }
      clientLines.push("    const queryString = query.toString();");
      clientLines.push("    const fullUrl = `${this.baseUrl}${urlPath}${queryString ? `?${queryString}` : ''}`;");
    } else {
      clientLines.push('    const fullUrl = `${this.baseUrl}${urlPath}`;');
    }

    // Headers
    const headerParams = (endpoint.parameters || []).filter((p) => p.in === 'header');
    clientLines.push('    const customHeaders: Record<string, string> = {};');
    if (hasBody) {
      clientLines.push("    customHeaders['Content-Type'] = 'application/json';");
    }
    for (const hp of headerParams) {
      const id = sanitizeTsIdentifier(toCamelCase(hp.name));
      clientLines.push(`    if (params.${id} !== undefined) {`);
      clientLines.push(`      customHeaders['${hp.name}'] = String(params.${id});`);
      clientLines.push('    }');
    }

    clientLines.push('    const headers = this.buildHeaders(customHeaders);');

    // Fetch call
    clientLines.push('    const response = await this.fetcher(fullUrl, {');
    clientLines.push(`      method: '${methodUpper}',`);
    clientLines.push('      headers,');
    if (hasBody) {
      clientLines.push('      body: JSON.stringify(body),');
    }
    clientLines.push('    });');

    // Error check
    clientLines.push('    if (!response.ok) {');
    clientLines.push('      let errorPayload: unknown;');
    clientLines.push('      try {');
    clientLines.push('        errorPayload = await response.json();');
    clientLines.push('      } catch {');
    clientLines.push('        errorPayload = await response.text();');
    clientLines.push('      }');
    clientLines.push('      throw new ApiHttpError(response.status, errorPayload);');
    clientLines.push('    }');

    // Response return
    if (responseTypeName === 'void') {
      clientLines.push('    return;');
    } else {
      clientLines.push(`    return (await response.json()) as Types.${responseTypeName};`);
    }

    clientLines.push('  }');
  }

  clientLines.push('}');
  files.push({
    path: 'src/client.ts',
    content: clientLines.join('\n').trim() + '\n',
  });

  // --- FILE: src/index.ts ---
  const indexContent = `/**
 * Auto-generated by HELIOS Polyglot SDK Generator.
 * Public SDK Entrypoint.
 */

export * from './types.js';
export * from './errors.js';
export * from './client.js';
`;
  files.push({
    path: 'src/index.ts',
    content: indexContent,
  });

  // --- FILE: package.json ---
  const packageJson = {
    name: options.packageName,
    version: options.packageVersion || '1.0.0',
    description: options.packageDescription || `${ast.title || 'API'} Client SDK for TypeScript`,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        default: './dist/index.js',
      },
    },
    scripts: {
      build: 'tsc',
      prepublishOnly: 'tsc',
    },
    license: options.license || 'Apache-2.0',
    devDependencies: {
      typescript: '^5.4.5',
    },
  };
  files.push({
    path: 'package.json',
    content: JSON.stringify(packageJson, null, 2) + '\n',
  });

  // --- FILE: tsconfig.json ---
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      declaration: true,
      outDir: './dist',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['src/**/*'],
  };
  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify(tsconfig, null, 2) + '\n',
  });

  // --- FILE: README.md ---
  const readmeContent = `# ${options.packageName}

Auto-generated TypeScript client SDK for **${ast.title || 'API'}** (v${ast.version || '1.0.0'}).

## Installation

\`\`\`bash
npm install ${options.packageName}
\`\`\`

## Quickstart

\`\`\`typescript
import { ${clientClassName} } from '${options.packageName}';

const client = new ${clientClassName}({
  baseUrl: '${defaultBaseUrl}',
  auth: {
    bearerToken: 'your-token-here',
  },
});
\`\`\`
`;
  files.push({
    path: 'README.md',
    content: readmeContent,
  });

  // Ensure deterministic file order
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    target: 'typescript',
    packageName: options.packageName,
    packageVersion: options.packageVersion || '1.0.0',
    files,
    warnings,
    stats: {
      totalFiles: files.length,
      totalEndpointsCovered: sortedEndpoints.length,
      totalModelsGenerated: declaredModels.size,
    },
  };
}
