/**
 * @helios/canonical-ast
 * Normalization engine and invariant validator for the Canonical AST.
 * Enforces uniform formatting, stable identities, and structural guarantees.
 */

import type {
  CanonicalAstError,
  CanonicalAstWarning,
  CanonicalEndpoint,
  CanonicalHeader,
  CanonicalInfo,
  CanonicalMediaType,
  CanonicalParameter,
  CanonicalRequestBody,
  CanonicalResponse,
  CanonicalSchema,
  CanonicalSecurityRequirement,
  CanonicalSecurityScheme,
  HttpMethod,
  ParameterLocation,
  SecuritySchemeType,
} from './types.js';

export const VALID_HTTP_METHODS: ReadonlySet<HttpMethod> = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
]);

export class AstNormalizer {
  /**
   * Normalizes an API path into a consistent canonical representation:
   * - Ensures leading slash
   * - Collapses multiple consecutive slashes
   * - Removes trailing slashes (except root "/")
   * - Trims surrounding whitespace
   */
  public static normalizePath(rawPath: string): string {
    if (!rawPath || typeof rawPath !== 'string') {
      return '/';
    }
    const trimmed = rawPath.trim();
    const collapsed = trimmed.replace(/\/+/g, '/');
    const withLeading = collapsed.startsWith('/') ? collapsed : `/${collapsed}`;
    if (withLeading.length > 1 && withLeading.endsWith('/')) {
      return withLeading.slice(0, -1);
    }
    return withLeading;
  }

  /**
   * Normalizes an HTTP method string to lowercase.
   */
  public static normalizeMethod(rawMethod: string): HttpMethod | null {
    if (!rawMethod || typeof rawMethod !== 'string') {
      return null;
    }
    const lower = rawMethod.trim().toLowerCase();
    return VALID_HTTP_METHODS.has(lower as HttpMethod) ? (lower as HttpMethod) : null;
  }

  /**
   * Generates a deterministic, stable endpoint identity based on method and path.
   * e.g., "get:/users/{id}" or "post:/pets"
   */
  public static generateEndpointId(method: HttpMethod, normalizedPath: string): string {
    return `${method}:${normalizedPath}`;
  }

  /**
   * Validates if a status code string is a standard 3-digit HTTP code (100-599),
   * wildcard (1XX-5XX), or "default".
   */
  public static isValidStatusCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;
    const trimmed = code.trim();
    if (trimmed.toLowerCase() === 'default') return true;
    if (/^[1-5][0-9]{2}$/.test(trimmed)) return true;
    if (/^[1-5]xx$/i.test(trimmed)) return true;
    return false;
  }

  /**
   * Normalizes API info metadata.
   */
  public static normalizeInfo(
    raw: unknown,
    errors: CanonicalAstError[],
    _warnings: CanonicalAstWarning[]
  ): CanonicalInfo {
    if (typeof raw !== 'object' || raw === null) {
      errors.push({
        code: 'INVALID_INVARIANT',
        message: 'Specification must contain a valid "info" object.',
        path: ['info'],
      });
      return { title: 'Untitled API', version: '0.0.0' };
    }

    const infoObj = raw as Record<string, unknown>;
    const title = typeof infoObj.title === 'string' && infoObj.title.trim().length > 0
      ? infoObj.title.trim()
      : '';
    const version = typeof infoObj.version === 'string' && infoObj.version.trim().length > 0
      ? infoObj.version.trim()
      : '';

    if (!title) {
      errors.push({
        code: 'INVALID_INVARIANT',
        message: 'Specification info.title is missing or empty.',
        path: ['info', 'title'],
      });
    }

    if (!version) {
      errors.push({
        code: 'INVALID_INVARIANT',
        message: 'Specification info.version is missing or empty.',
        path: ['info', 'version'],
      });
    }

    return {
      title: title || 'Untitled API',
      version: version || '0.0.0',
      description: typeof infoObj.description === 'string' ? infoObj.description.trim() : undefined,
      termsOfService: typeof infoObj.termsOfService === 'string' ? infoObj.termsOfService.trim() : undefined,
      contact: typeof infoObj.contact === 'object' && infoObj.contact !== null
        ? (infoObj.contact as CanonicalInfo['contact'])
        : undefined,
      license: typeof infoObj.license === 'object' && infoObj.license !== null
        ? (infoObj.license as CanonicalInfo['license'])
        : undefined,
    };
  }

  /**
   * Normalizes a Schema node into CanonicalSchema with CanonicalProperty objects.
   */
  public static normalizeSchema(
    raw: unknown,
    _errors: CanonicalAstError[],
    _warnings: CanonicalAstWarning[],
    activeRefs = new Set<string>(),
    depth = 0,
    seenObjects = new WeakSet<object>()
  ): CanonicalSchema {
    if (depth > 64) {
      return {
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
        isCircular: true,
        description: 'Maximum recursion depth exceeded',
      };
    }

    if (typeof raw !== 'object' || raw === null) {
      return {
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
      };
    }

    const target = raw as Record<string, unknown>;
    const rawRef = typeof target.rawRef === 'string' ? target.rawRef : undefined;

    if (seenObjects.has(target) || (rawRef && activeRefs.has(rawRef))) {
      return {
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: [],
        rawRef,
        isCircular: true,
        description: rawRef ? `Circular reference to ${rawRef}` : 'Circular object reference detected',
      };
    }

    seenObjects.add(target);

    const nextActiveRefs = new Set(activeRefs);
    if (rawRef) {
      nextActiveRefs.add(rawRef);
    }

    // Required properties: deduplicated and alphabetically sorted
    const rawRequired = Array.isArray(target.required) ? (target.required as string[]) : [];
    const requiredProperties = Array.from(new Set(rawRequired.filter((r) => typeof r === 'string'))).sort();

    // Type normalization
    let type: string | string[] | undefined;
    let nullable = target.nullable === true;

    if (Array.isArray(target.type)) {
      const typeList = target.type.map(String);
      if (typeList.includes('null')) {
        nullable = true;
      }
      type = typeList.length === 1 ? typeList[0] : typeList;
    } else if (typeof target.type === 'string') {
      type = target.type.trim();
    }

    const schema: CanonicalSchema = {
      id: typeof target.id === 'string' ? target.id : (typeof target.$id === 'string' ? (target.$id as string) : undefined),
      type,
      format: typeof target.format === 'string' ? target.format.trim() : undefined,
      title: typeof target.title === 'string' ? target.title.trim() : undefined,
      description: typeof target.description === 'string' ? target.description : undefined,
      default: target.default,
      nullable,
      readOnly: target.readOnly === true,
      writeOnly: target.writeOnly === true,
      deprecated: target.deprecated === true,
      requiredProperties,
      enum: Array.isArray(target.enum) ? target.enum : undefined,
      example: target.example,
      examples: Array.isArray(target.examples) ? target.examples : undefined,
      maxLength: typeof target.maxLength === 'number' ? target.maxLength : undefined,
      minLength: typeof target.minLength === 'number' ? target.minLength : undefined,
      maxItems: typeof target.maxItems === 'number' ? target.maxItems : undefined,
      minItems: typeof target.minItems === 'number' ? target.minItems : undefined,
      minimum: typeof target.minimum === 'number' ? target.minimum : undefined,
      maximum: typeof target.maximum === 'number' ? target.maximum : undefined,
      rawRef,
      isCircular: target.isCircular === true,
    };

    // Object properties -> CanonicalProperty
    if (typeof target.properties === 'object' && target.properties !== null) {
      schema.properties = {};
      for (const [propName, propVal] of Object.entries(target.properties as Record<string, unknown>)) {
        const propSchema = AstNormalizer.normalizeSchema(
          propVal,
          _errors,
          _warnings,
          nextActiveRefs,
          depth + 1,
          seenObjects
        );
        const isRequired = requiredProperties.includes(propName);
        schema.properties[propName] = {
          name: propName,
          schema: propSchema,
          required: isRequired,
          description: propSchema.description,
        };
      }
    }

    // Array items
    if (typeof target.items === 'object' && target.items !== null) {
      schema.items = AstNormalizer.normalizeSchema(
        target.items,
        _errors,
        _warnings,
        nextActiveRefs,
        depth + 1,
        seenObjects
      );
    }

    // Additional properties
    if (typeof target.additionalProperties === 'boolean') {
      schema.additionalProperties = target.additionalProperties;
    } else if (typeof target.additionalProperties === 'object' && target.additionalProperties !== null) {
      schema.additionalProperties = AstNormalizer.normalizeSchema(
        target.additionalProperties,
        _errors,
        _warnings,
        nextActiveRefs,
        depth + 1,
        seenObjects
      );
    }

    // Polymorphism: allOf, anyOf, oneOf
    for (const poly of ['allOf', 'anyOf', 'oneOf'] as const) {
      if (Array.isArray(target[poly])) {
        schema[poly] = (target[poly] as unknown[]).map((item) =>
          AstNormalizer.normalizeSchema(item, _errors, _warnings, nextActiveRefs, depth + 1, seenObjects)
        );
      }
    }

    return schema;
  }

  /**
   * Normalizes an API parameter.
   */
  public static normalizeParameter(
    raw: unknown,
    errors: CanonicalAstError[],
    warnings: CanonicalAstWarning[]
  ): CanonicalParameter | null {
    if (typeof raw !== 'object' || raw === null) {
      errors.push({
        code: 'MALFORMED_STRUCTURE',
        message: 'Parameter must be an object.',
      });
      return null;
    }

    const p = raw as Record<string, unknown>;
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    const inLoc = (typeof p.in === 'string' ? p.in.trim().toLowerCase() : 'query') as ParameterLocation;

    if (!name) {
      errors.push({
        code: 'INVALID_INVARIANT',
        message: 'Parameter must have a non-empty name.',
      });
      return null;
    }

    // Path parameters MUST have required: true
    const required = inLoc === 'path' ? true : p.required === true;

    let schema: CanonicalSchema | undefined;
    if (p.schema) {
      schema = AstNormalizer.normalizeSchema(p.schema, errors, warnings);
    }

    return {
      name,
      in: inLoc,
      required,
      deprecated: p.deprecated === true,
      description: typeof p.description === 'string' ? p.description : undefined,
      schema,
    };
  }

  /**
   * Normalizes an API RequestBody.
   */
  public static normalizeRequestBody(
    raw: unknown,
    errors: CanonicalAstError[],
    warnings: CanonicalAstWarning[]
  ): CanonicalRequestBody | undefined {
    if (typeof raw !== 'object' || raw === null) {
      return undefined;
    }

    const body = raw as Record<string, unknown>;
    const content: Record<string, CanonicalMediaType> = {};

    if (typeof body.content === 'object' && body.content !== null) {
      for (const [mediaType, mediaVal] of Object.entries(body.content as Record<string, unknown>)) {
        if (typeof mediaVal === 'object' && mediaVal !== null) {
          const mObj = mediaVal as Record<string, unknown>;
          let schema: CanonicalSchema | undefined;
          if (mObj.schema) {
            schema = AstNormalizer.normalizeSchema(mObj.schema, errors, warnings);
          }
          content[mediaType] = {
            schema,
            example: mObj.example,
            examples: typeof mObj.examples === 'object' ? (mObj.examples as Record<string, unknown>) : undefined,
          };
        }
      }
    }

    return {
      description: typeof body.description === 'string' ? body.description : undefined,
      required: body.required === true,
      content,
    };
  }

  /**
   * Normalizes an API Response object and validates status codes.
   */
  public static normalizeResponse(
    statusCode: string,
    raw: unknown,
    errors: CanonicalAstError[],
    warnings: CanonicalAstWarning[]
  ): CanonicalResponse {
    if (!AstNormalizer.isValidStatusCode(statusCode)) {
      errors.push({
        code: 'INVALID_STATUS_CODE',
        message: `Invalid HTTP response status code: "${statusCode}". Expected 3-digit code (100-599), wildcard (1XX-5XX), or "default".`,
        path: ['responses', statusCode],
      });
    }

    if (typeof raw !== 'object' || raw === null) {
      return {
        statusCode,
        description: '',
      };
    }

    const resp = raw as Record<string, unknown>;
    const description = typeof resp.description === 'string' ? resp.description : '';

    const headers: Record<string, CanonicalHeader> = {};
    if (typeof resp.headers === 'object' && resp.headers !== null) {
      for (const [hName, hVal] of Object.entries(resp.headers as Record<string, unknown>)) {
        if (typeof hVal === 'object' && hVal !== null) {
          const hObj = hVal as Record<string, unknown>;
          headers[hName] = {
            description: typeof hObj.description === 'string' ? hObj.description : undefined,
            required: hObj.required === true,
            deprecated: hObj.deprecated === true,
            schema: hObj.schema ? AstNormalizer.normalizeSchema(hObj.schema, errors, warnings) : undefined,
          };
        }
      }
    }

    const content: Record<string, CanonicalMediaType> = {};
    if (typeof resp.content === 'object' && resp.content !== null) {
      for (const [mediaType, mediaVal] of Object.entries(resp.content as Record<string, unknown>)) {
        if (typeof mediaVal === 'object' && mediaVal !== null) {
          const mObj = mediaVal as Record<string, unknown>;
          content[mediaType] = {
            schema: mObj.schema ? AstNormalizer.normalizeSchema(mObj.schema, errors, warnings) : undefined,
            example: mObj.example,
            examples: typeof mObj.examples === 'object' ? (mObj.examples as Record<string, unknown>) : undefined,
          };
        }
      }
    }

    return {
      statusCode,
      description,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      content: Object.keys(content).length > 0 ? content : undefined,
    };
  }

  /**
   * Normalizes an Endpoint node and verifies invariants:
   * - Non-empty path
   * - Valid HTTP method
   * - Deduplicated parameters
   * - Validated responses
   */
  public static normalizeEndpoint(
    raw: unknown,
    seenEndpointIds: Set<string>,
    errors: CanonicalAstError[],
    warnings: CanonicalAstWarning[]
  ): CanonicalEndpoint | null {
    if (typeof raw !== 'object' || raw === null) {
      errors.push({
        code: 'MALFORMED_STRUCTURE',
        message: 'Endpoint must be an object.',
      });
      return null;
    }

    const ep = raw as Record<string, unknown>;
    const rawPath = typeof ep.path === 'string' ? ep.path : '';
    const rawMethod = typeof ep.method === 'string' ? ep.method : '';

    if (!rawPath.trim()) {
      errors.push({
        code: 'INVALID_INVARIANT',
        message: 'Endpoint is missing required "path".',
      });
      return null;
    }

    const method = AstNormalizer.normalizeMethod(rawMethod);
    if (!method) {
      errors.push({
        code: 'INVALID_INVARIANT',
        message: `Invalid or unsupported HTTP method: "${rawMethod}". Supported methods: ${Array.from(
          VALID_HTTP_METHODS
        ).join(', ')}.`,
        path: [rawPath, rawMethod],
      });
      return null;
    }

    const normalizedPath = AstNormalizer.normalizePath(rawPath);
    const stableId = AstNormalizer.generateEndpointId(method, normalizedPath);

    // Collision check for duplicate endpoint identity
    if (seenEndpointIds.has(stableId)) {
      errors.push({
        code: 'DUPLICATE_ENDPOINT',
        message: `Duplicate endpoint identity detected: "${stableId}". Every HTTP method and path combination must be unique.`,
        path: [normalizedPath, method],
      });
      return null;
    }
    seenEndpointIds.add(stableId);

    // Parameters normalization
    const parameters: CanonicalParameter[] = [];
    if (Array.isArray(ep.parameters)) {
      const paramMap = new Map<string, CanonicalParameter>();
      for (const rawParam of ep.parameters) {
        const p = AstNormalizer.normalizeParameter(rawParam, errors, warnings);
        if (p) {
          paramMap.set(`${p.in}:${p.name}`, p);
        }
      }
      // Sort parameters deterministically: by location, then by name
      parameters.push(
        ...Array.from(paramMap.values()).sort((a, b) => {
          if (a.in !== b.in) return a.in.localeCompare(b.in);
          return a.name.localeCompare(b.name);
        })
      );
    }

    // Request body normalization
    const requestBody = AstNormalizer.normalizeRequestBody(ep.requestBody, errors, warnings);

    // Responses normalization
    const responses: Record<string, CanonicalResponse> = {};
    if (typeof ep.responses === 'object' && ep.responses !== null) {
      for (const [code, rawResp] of Object.entries(ep.responses as Record<string, unknown>)) {
        responses[code] = AstNormalizer.normalizeResponse(code, rawResp, errors, warnings);
      }
    }

    // Security requirements
    const security: CanonicalSecurityRequirement[] = [];
    if (Array.isArray(ep.security)) {
      for (const secItem of ep.security) {
        if (typeof secItem === 'object' && secItem !== null) {
          const sObj = secItem as Record<string, unknown>;
          if (typeof sObj.name === 'string') {
            security.push({
              name: sObj.name,
              scopes: Array.isArray(sObj.scopes) ? (sObj.scopes as string[]) : [],
            });
          }
        }
      }
    }

    return {
      id: stableId,
      path: normalizedPath,
      method,
      operationId: typeof ep.operationId === 'string' ? ep.operationId.trim() : undefined,
      summary: typeof ep.summary === 'string' ? ep.summary.trim() : undefined,
      description: typeof ep.description === 'string' ? ep.description.trim() : undefined,
      deprecated: ep.deprecated === true,
      tags: Array.isArray(ep.tags) ? (ep.tags.filter((t) => typeof t === 'string') as string[]) : [],
      parameters,
      requestBody,
      responses,
      security: security.length > 0 ? security : undefined,
    };
  }

  /**
   * Normalizes security schemes.
   */
  public static normalizeSecuritySchemes(
    raw: unknown
  ): Record<string, CanonicalSecurityScheme> {
    const result: Record<string, CanonicalSecurityScheme> = {};
    if (typeof raw !== 'object' || raw === null) {
      return result;
    }

    for (const [key, schemeVal] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof schemeVal === 'object' && schemeVal !== null) {
        const s = schemeVal as Record<string, unknown>;
        result[key] = {
          id: key,
          type: (s.type as SecuritySchemeType) ?? 'apiKey',
          description: typeof s.description === 'string' ? s.description : undefined,
          name: typeof s.name === 'string' ? s.name : undefined,
          in: s.in as 'query' | 'header' | 'cookie' | undefined,
          scheme: typeof s.scheme === 'string' ? s.scheme : undefined,
          bearerFormat: typeof s.bearerFormat === 'string' ? s.bearerFormat : undefined,
          flows: typeof s.flows === 'object' ? (s.flows as Record<string, unknown>) : undefined,
          openIdConnectUrl: typeof s.openIdConnectUrl === 'string' ? s.openIdConnectUrl : undefined,
        };
      }
    }

    return result;
  }
}
