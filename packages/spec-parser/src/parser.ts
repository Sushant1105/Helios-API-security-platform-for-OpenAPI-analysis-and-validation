/**
 * @helios/spec-parser
 * Production-ready OpenAPI 3.0 and 3.1 specification parser and normalizer.
 */

import { parse as parseYaml } from 'yaml';
import { createHash } from 'node:crypto';
import type {
  HttpMethod,
  ParameterLocation,
  SecuritySchemeType,
} from '@helios/canonical-ast';
import type {
  ParsedApiInfo,
  ParsedComponents,
  ParsedEndpoint,
  ParsedHeader,
  ParsedMediaType,
  ParsedOpenAPISpec,
  ParsedParameter,
  ParsedRequestBody,
  ParsedResponse,
  ParsedSchema,
  ParsedSecurityRequirement,
  ParsedServer,
  ParsedSpecMetadata,
  ParsedTag,
  ParserError,
  ParserWarning,
  ParseOptions,
  ParseResult,
} from './types.js';
import { LocalRefResolver } from './resolver.js';

const VALID_HTTP_METHODS: ReadonlySet<HttpMethod> = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
]);

export class OpenApiParser {
  /**
   * Detects whether input string is JSON or YAML.
   */
  public static detectFormat(content: string): 'json' | 'yaml' {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'json';
    }
    return 'yaml';
  }

  /**
   * Main entry point to parse an OpenAPI specification from raw text.
   */
  public static parse(rawContent: string, options?: ParseOptions): ParseResult {
    const warnings: ParserWarning[] = [];

    if (!rawContent || typeof rawContent !== 'string' || rawContent.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input specification is empty or not a valid string.',
        },
        warnings,
      };
    }

    const format = OpenApiParser.detectFormat(rawContent);

    // 1. Syntax Parsing
    let rawDoc: unknown;
    try {
      if (format === 'json') {
        rawDoc = JSON.parse(rawContent);
      } else {
        rawDoc = parseYaml(rawContent, { prettyErrors: true });
      }
    } catch (syntaxErr) {
      return {
        success: false,
        error: {
          code: 'SYNTAX_ERROR',
          message: `Failed to parse ${format.toUpperCase()}: ${
            syntaxErr instanceof Error ? syntaxErr.message : String(syntaxErr)
          }`,
          details: syntaxErr,
        },
        warnings,
      };
    }

    // 2. Validate Root Object Structure
    if (typeof rawDoc !== 'object' || rawDoc === null || Array.isArray(rawDoc)) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'OpenAPI root document must be a JSON/YAML object.',
        },
        warnings,
      };
    }

    const doc = rawDoc as Record<string, unknown>;

    // 3. Version Detection and Validation
    if (!('openapi' in doc) || typeof doc.openapi !== 'string') {
      if ('swagger' in doc) {
        return {
          success: false,
          error: {
            code: 'UNSUPPORTED_VERSION',
            message: `OpenAPI 2.0 (Swagger) specifications are not supported. Found swagger: "${String(
              doc.swagger
            )}". Supported versions are 3.0.x and 3.1.x.`,
            path: ['swagger'],
          },
          warnings,
        };
      }

      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required root property "openapi".',
          path: ['openapi'],
        },
        warnings,
      };
    }

    const openapiStr = doc.openapi.trim();
    let specVersion: '3.0' | '3.1';

    if (openapiStr.startsWith('3.0')) {
      specVersion = '3.0';
    } else if (openapiStr.startsWith('3.1')) {
      specVersion = '3.1';
    } else {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_VERSION',
          message: `Unsupported OpenAPI version "${openapiStr}". Only OpenAPI 3.0.x and 3.1.x are supported.`,
          path: ['openapi'],
        },
        warnings,
      };
    }

    // 4. Validate Required Root Properties: info & paths
    if (!('info' in doc) || typeof doc.info !== 'object' || doc.info === null) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required root property "info".',
          path: ['info'],
        },
        warnings,
      };
    }

    const rawInfo = doc.info as Record<string, unknown>;
    if (!rawInfo.title || typeof rawInfo.title !== 'string') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required property "info.title".',
          path: ['info', 'title'],
        },
        warnings,
      };
    }

    if (!rawInfo.version || typeof rawInfo.version !== 'string') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required property "info.version".',
          path: ['info', 'version'],
        },
        warnings,
      };
    }

    if (!('paths' in doc) || typeof doc.paths !== 'object' || doc.paths === null) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required root property "paths".',
          path: ['paths'],
        },
        warnings,
      };
    }

    // 5. Reference Resolver Setup
    const resolver = new LocalRefResolver(doc);
    const shouldResolveRefs = options?.resolveLocalReferences !== false;

    // 6. Normalize Info
    const info: ParsedApiInfo = {
      title: rawInfo.title,
      version: rawInfo.version,
      description: typeof rawInfo.description === 'string' ? rawInfo.description : undefined,
      termsOfService:
        typeof rawInfo.termsOfService === 'string' ? rawInfo.termsOfService : undefined,
      contact:
        typeof rawInfo.contact === 'object' && rawInfo.contact !== null
          ? (rawInfo.contact as ParsedApiInfo['contact'])
          : undefined,
      license:
        typeof rawInfo.license === 'object' && rawInfo.license !== null
          ? (rawInfo.license as ParsedApiInfo['license'])
          : undefined,
    };

    // 7. Normalize Servers
    const servers: ParsedServer[] = [];
    if (Array.isArray(doc.servers)) {
      for (const s of doc.servers) {
        if (typeof s === 'object' && s !== null && typeof s.url === 'string') {
          servers.push({
            url: s.url,
            description: typeof s.description === 'string' ? s.description : undefined,
            variables: typeof s.variables === 'object' ? s.variables : undefined,
          });
        }
      }
    }

    // 8. Normalize Tags
    const tags: ParsedTag[] = [];
    if (Array.isArray(doc.tags)) {
      for (const t of doc.tags) {
        if (typeof t === 'object' && t !== null && typeof t.name === 'string') {
          tags.push({
            name: t.name,
            description: typeof t.description === 'string' ? t.description : undefined,
            externalDocs: typeof t.externalDocs === 'object' ? t.externalDocs : undefined,
          });
        }
      }
    }

    // 9. Normalize Global Security Requirements
    const security: ParsedSecurityRequirement[] = [];
    if (Array.isArray(doc.security)) {
      for (const secItem of doc.security) {
        if (typeof secItem === 'object' && secItem !== null) {
          for (const [name, scopes] of Object.entries(secItem)) {
            security.push({
              name,
              scopes: Array.isArray(scopes) ? (scopes as string[]) : [],
            });
          }
        }
      }
    }

    // 10. Normalize Components
    const rawComponents =
      typeof doc.components === 'object' && doc.components !== null
        ? (doc.components as Record<string, unknown>)
        : {};

    const components: ParsedComponents = {
      schemas: {},
      securitySchemes: {},
      parameters: {},
      responses: {},
      requestBodies: {},
    };

    // Schemas in components
    if (typeof rawComponents.schemas === 'object' && rawComponents.schemas !== null) {
      for (const [schemaName, rawSchema] of Object.entries(
        rawComponents.schemas as Record<string, unknown>
      )) {
        const schemaRefKey = `#/components/schemas/${schemaName}`;
        const normalized = OpenApiParser.normalizeSchema(
          rawSchema,
          resolver,
          shouldResolveRefs,
          new Set([schemaRefKey])
        );
        if (!normalized.success) {
          return {
            success: false,
            error: normalized.error!,
            warnings,
          };
        }
        components.schemas[schemaName] = normalized.value!;
      }
    }

    // Security Schemes in components
    if (
      typeof rawComponents.securitySchemes === 'object' &&
      rawComponents.securitySchemes !== null
    ) {
      for (const [schemeId, rawScheme] of Object.entries(
        rawComponents.securitySchemes as Record<string, unknown>
      )) {
        if (typeof rawScheme === 'object' && rawScheme !== null) {
          const schemeObj = rawScheme as Record<string, unknown>;
          components.securitySchemes[schemeId] = {
            id: schemeId,
            type: (schemeObj.type as SecuritySchemeType) ?? 'apiKey',
            description:
              typeof schemeObj.description === 'string' ? schemeObj.description : undefined,
            name: typeof schemeObj.name === 'string' ? schemeObj.name : undefined,
            in: schemeObj.in as 'query' | 'header' | 'cookie' | undefined,
            scheme: typeof schemeObj.scheme === 'string' ? schemeObj.scheme : undefined,
            bearerFormat:
              typeof schemeObj.bearerFormat === 'string' ? schemeObj.bearerFormat : undefined,
            flows: typeof schemeObj.flows === 'object' ? schemeObj.flows as Record<string, unknown> : undefined,
            openIdConnectUrl:
              typeof schemeObj.openIdConnectUrl === 'string'
                ? schemeObj.openIdConnectUrl
                : undefined,
          };
        }
      }
    }

    // 11. Normalize Endpoints from Paths
    const rawPaths = doc.paths as Record<string, unknown>;
    const endpoints: ParsedEndpoint[] = [];

    for (const [pathKey, pathItem] of Object.entries(rawPaths)) {
      if (typeof pathItem !== 'object' || pathItem === null) {
        continue;
      }

      const pathObj = pathItem as Record<string, unknown>;

      // Resolve path item level $ref if present
      let resolvedPathObj = pathObj;
      if (LocalRefResolver.isRefNode(pathObj)) {
        const resPath = resolver.resolvePointer<Record<string, unknown>>(pathObj.$ref);
        if (!resPath.success) {
          return { success: false, error: resPath.error!, warnings };
        }
        resolvedPathObj = resPath.value ?? pathObj;
      }

      // Path-level common parameters
      const pathLevelParams: ParsedParameter[] = [];
      if (Array.isArray(resolvedPathObj.parameters)) {
        for (const rawParam of resolvedPathObj.parameters) {
          const paramRes = OpenApiParser.normalizeParameter(rawParam, resolver, shouldResolveRefs);
          if (!paramRes.success) {
            return { success: false, error: paramRes.error!, warnings };
          }
          pathLevelParams.push(paramRes.value!);
        }
      }

      // Check HTTP Methods
      for (const [key, operation] of Object.entries(resolvedPathObj)) {
        const method = key.toLowerCase() as HttpMethod;
        if (!VALID_HTTP_METHODS.has(method)) {
          continue;
        }

        if (typeof operation !== 'object' || operation === null) {
          continue;
        }

        const op = operation as Record<string, unknown>;
        const endpointId = `${method.toUpperCase()} ${pathKey}`;

        // Merge parameters: operation params take precedence over path params
        const opParams: ParsedParameter[] = [];
        if (Array.isArray(op.parameters)) {
          for (const rawParam of op.parameters) {
            const paramRes = OpenApiParser.normalizeParameter(
              rawParam,
              resolver,
              shouldResolveRefs
            );
            if (!paramRes.success) {
              return { success: false, error: paramRes.error!, warnings };
            }
            opParams.push(paramRes.value!);
          }
        }

        // De-duplicate parameters: operation overrides path param with same name and location
        const paramMap = new Map<string, ParsedParameter>();
        for (const p of pathLevelParams) {
          paramMap.set(`${p.name}:${p.in}`, p);
        }
        for (const p of opParams) {
          paramMap.set(`${p.name}:${p.in}`, p);
        }
        const mergedParameters = Array.from(paramMap.values());

        // Normalize Request Body
        let requestBody: ParsedRequestBody | undefined;
        if (op.requestBody) {
          const bodyRes = OpenApiParser.normalizeRequestBody(
            op.requestBody,
            resolver,
            shouldResolveRefs
          );
          if (!bodyRes.success) {
            return { success: false, error: bodyRes.error!, warnings };
          }
          requestBody = bodyRes.value;
        }

        // Normalize Responses
        const responses: Record<string, ParsedResponse> = {};
        if (typeof op.responses === 'object' && op.responses !== null) {
          for (const [code, rawResp] of Object.entries(op.responses as Record<string, unknown>)) {
            const respRes = OpenApiParser.normalizeResponse(
              code,
              rawResp,
              resolver,
              shouldResolveRefs
            );
            if (!respRes.success) {
              return { success: false, error: respRes.error!, warnings };
            }
            responses[code] = respRes.value!;
          }
        }

        // Normalize Operation Security
        let opSecurity: ParsedSecurityRequirement[] | undefined;
        if (Array.isArray(op.security)) {
          opSecurity = [];
          for (const secItem of op.security) {
            if (typeof secItem === 'object' && secItem !== null) {
              for (const [sName, sScopes] of Object.entries(secItem)) {
                opSecurity.push({
                  name: sName,
                  scopes: Array.isArray(sScopes) ? (sScopes as string[]) : [],
                });
              }
            }
          }
        } else if (security.length > 0) {
          // Inherit root document security
          opSecurity = [...security];
        }

        endpoints.push({
          id: endpointId,
          path: pathKey,
          method,
          operationId: typeof op.operationId === 'string' ? op.operationId : undefined,
          summary: typeof op.summary === 'string' ? op.summary : undefined,
          description: typeof op.description === 'string' ? op.description : undefined,
          deprecated: op.deprecated === true,
          tags: Array.isArray(op.tags) ? (op.tags as string[]) : undefined,
          parameters: mergedParameters,
          requestBody,
          responses,
          security: opSecurity,
        });
      }
    }

    // 12. Metadata
    const sourceHash = createHash('sha256').update(rawContent).digest('hex');
    const metadata: ParsedSpecMetadata = {
      parsedAt: new Date().toISOString(),
      sourceFormat: format,
      specVersion,
      sourceHash,
      totalEndpoints: endpoints.length,
      totalSchemas: Object.keys(components.schemas).length,
    };

    const parsedSpec: ParsedOpenAPISpec = {
      openapi: openapiStr,
      specVersion,
      format,
      info,
      servers,
      tags,
      endpoints,
      components,
      security,
      metadata,
      rawDoc: doc,
    };

    return {
      success: true,
      data: parsedSpec,
      warnings,
    };
  }

  /**
   * Normalize an OpenAPI Schema node into ParsedSchema.
   */
  private static normalizeSchema(
    raw: unknown,
    resolver: LocalRefResolver,
    shouldResolve: boolean,
    activeRefs: Set<string> = new Set(),
    depth = 0
  ): { success: boolean; value?: ParsedSchema; error?: ParserError } {
    if (depth > 64) {
      return {
        success: true,
        value: {
          isCircular: true,
          description: 'Maximum schema depth exceeded',
        },
      };
    }

    if (typeof raw !== 'object' || raw === null) {
      return { success: true, value: {} };
    }

    let target = raw as Record<string, unknown>;
    let rawRef: string | undefined;

    if (LocalRefResolver.isRefNode(target)) {
      rawRef = target.$ref;
      if (activeRefs.has(rawRef)) {
        return {
          success: true,
          value: {
            rawRef,
            isCircular: true,
            description: `Circular reference to ${rawRef}`,
          },
        };
      }

      if (shouldResolve) {
        const res = resolver.resolvePointer<Record<string, unknown>>(target.$ref);
        if (!res.success) {
          return { success: false, error: res.error };
        }
        if (res.value && typeof res.value === 'object') {
          target = { ...res.value, ...target };
        }
      } else {
        return { success: true, value: { rawRef } };
      }
    }

    const nextActiveRefs = new Set(activeRefs);
    if (rawRef) {
      nextActiveRefs.add(rawRef);
    }

    const schema: ParsedSchema = {
      id: typeof target['$id'] === 'string' ? (target['$id'] as string) : undefined,
      type: target.type as string | string[] | undefined,
      format: typeof target.format === 'string' ? target.format : undefined,
      title: typeof target.title === 'string' ? target.title : undefined,
      description: typeof target.description === 'string' ? target.description : undefined,
      default: target.default,
      nullable: target.nullable === true,
      readOnly: target.readOnly === true,
      writeOnly: target.writeOnly === true,
      deprecated: target.deprecated === true,
      required: Array.isArray(target.required) ? (target.required as string[]) : undefined,
      enum: Array.isArray(target.enum) ? target.enum : undefined,
      rawRef,
      isCircular: target.isCircular === true,
    };

    // Properties
    if (typeof target.properties === 'object' && target.properties !== null) {
      schema.properties = {};
      for (const [propName, propVal] of Object.entries(
        target.properties as Record<string, unknown>
      )) {
        const propRes = OpenApiParser.normalizeSchema(
          propVal,
          resolver,
          shouldResolve,
          nextActiveRefs,
          depth + 1
        );
        if (!propRes.success) {
          return propRes;
        }
        schema.properties[propName] = propRes.value!;
      }
    }

    // Items
    if (typeof target.items === 'object' && target.items !== null) {
      const itemsRes = OpenApiParser.normalizeSchema(
        target.items,
        resolver,
        shouldResolve,
        nextActiveRefs,
        depth + 1
      );
      if (!itemsRes.success) {
        return itemsRes;
      }
      schema.items = itemsRes.value;
    }

    // Polymorphism: allOf, anyOf, oneOf
    for (const polyKey of ['allOf', 'anyOf', 'oneOf'] as const) {
      if (Array.isArray(target[polyKey])) {
        const polyList: ParsedSchema[] = [];
        for (const item of target[polyKey] as unknown[]) {
          const itemRes = OpenApiParser.normalizeSchema(
            item,
            resolver,
            shouldResolve,
            nextActiveRefs,
            depth + 1
          );
          if (!itemRes.success) {
            return itemRes;
          }
          polyList.push(itemRes.value!);
        }
        schema[polyKey] = polyList;
      }
    }

    return { success: true, value: schema };
  }

  /**
   * Normalize an OpenAPI Parameter node.
   */
  private static normalizeParameter(
    raw: unknown,
    resolver: LocalRefResolver,
    shouldResolve: boolean
  ): { success: boolean; value?: ParsedParameter; error?: ParserError } {
    let target = raw as Record<string, unknown>;

    if (LocalRefResolver.isRefNode(target)) {
      if (shouldResolve) {
        const res = resolver.resolvePointer<Record<string, unknown>>(target.$ref);
        if (!res.success) {
          return { success: false, error: res.error };
        }
        target = { ...res.value, ...target };
      }
    }

    const name = String(target.name ?? 'unnamed');
    const inLoc = (target.in as ParameterLocation) ?? 'query';
    const required = inLoc === 'path' ? true : target.required === true;

    let schema: ParsedSchema | undefined;
    if (target.schema) {
      const sRes = OpenApiParser.normalizeSchema(target.schema, resolver, shouldResolve);
      if (!sRes.success) {
        return { success: false, error: sRes.error };
      }
      schema = sRes.value;
    }

    return {
      success: true,
      value: {
        name,
        in: inLoc,
        required,
        deprecated: target.deprecated === true,
        description: typeof target.description === 'string' ? target.description : undefined,
        schema,
      },
    };
  }

  /**
   * Normalize an OpenAPI RequestBody node.
   */
  private static normalizeRequestBody(
    raw: unknown,
    resolver: LocalRefResolver,
    shouldResolve: boolean
  ): { success: boolean; value?: ParsedRequestBody; error?: ParserError } {
    let target = raw as Record<string, unknown>;

    if (LocalRefResolver.isRefNode(target)) {
      if (shouldResolve) {
        const res = resolver.resolvePointer<Record<string, unknown>>(target.$ref);
        if (!res.success) {
          return { success: false, error: res.error };
        }
        target = { ...res.value, ...target };
      }
    }

    const content: Record<string, ParsedMediaType> = {};
    if (typeof target.content === 'object' && target.content !== null) {
      for (const [mediaType, mediaVal] of Object.entries(
        target.content as Record<string, unknown>
      )) {
        if (typeof mediaVal === 'object' && mediaVal !== null) {
          const mObj = mediaVal as Record<string, unknown>;
          let schema: ParsedSchema | undefined;
          if (mObj.schema) {
            const sRes = OpenApiParser.normalizeSchema(mObj.schema, resolver, shouldResolve);
            if (!sRes.success) {
              return { success: false, error: sRes.error };
            }
            schema = sRes.value;
          }
          content[mediaType] = {
            schema,
            example: mObj.example,
            examples: typeof mObj.examples === 'object' ? mObj.examples as Record<string, unknown> : undefined,
          };
        }
      }
    }

    return {
      success: true,
      value: {
        description: typeof target.description === 'string' ? target.description : undefined,
        required: target.required === true,
        content,
      },
    };
  }

  /**
   * Normalize an OpenAPI Response node.
   */
  private static normalizeResponse(
    statusCode: string,
    raw: unknown,
    resolver: LocalRefResolver,
    shouldResolve: boolean
  ): { success: boolean; value?: ParsedResponse; error?: ParserError } {
    let target = raw as Record<string, unknown>;

    if (LocalRefResolver.isRefNode(target)) {
      if (shouldResolve) {
        const res = resolver.resolvePointer<Record<string, unknown>>(target.$ref);
        if (!res.success) {
          return { success: false, error: res.error };
        }
        target = { ...res.value, ...target };
      }
    }

    const description = typeof target.description === 'string' ? target.description : '';

    const headers: Record<string, ParsedHeader> = {};
    if (typeof target.headers === 'object' && target.headers !== null) {
      for (const [hName, hVal] of Object.entries(target.headers as Record<string, unknown>)) {
        if (typeof hVal === 'object' && hVal !== null) {
          const hObj = hVal as Record<string, unknown>;
          let schema: ParsedSchema | undefined;
          if (hObj.schema) {
            const sRes = OpenApiParser.normalizeSchema(hObj.schema, resolver, shouldResolve);
            if (!sRes.success) {
              return { success: false, error: sRes.error };
            }
            schema = sRes.value;
          }
          headers[hName] = {
            description: typeof hObj.description === 'string' ? hObj.description : undefined,
            required: hObj.required === true,
            deprecated: hObj.deprecated === true,
            schema,
          };
        }
      }
    }

    const content: Record<string, ParsedMediaType> = {};
    if (typeof target.content === 'object' && target.content !== null) {
      for (const [mediaType, mediaVal] of Object.entries(
        target.content as Record<string, unknown>
      )) {
        if (typeof mediaVal === 'object' && mediaVal !== null) {
          const mObj = mediaVal as Record<string, unknown>;
          let schema: ParsedSchema | undefined;
          if (mObj.schema) {
            const sRes = OpenApiParser.normalizeSchema(mObj.schema, resolver, shouldResolve);
            if (!sRes.success) {
              return { success: false, error: sRes.error };
            }
            schema = sRes.value;
          }
          content[mediaType] = {
            schema,
            example: mObj.example,
            examples: typeof mObj.examples === 'object' ? mObj.examples as Record<string, unknown> : undefined,
          };
        }
      }
    }

    return {
      success: true,
      value: {
        statusCode,
        description,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        content: Object.keys(content).length > 0 ? content : undefined,
      },
    };
  }
}
