/**
 * @helios/canonical-ast
 * Builder that transforms parsed OpenAPI specifications into the Canonical Intermediate Representation (AST).
 */

import type {
  CanonicalApiAst,
  CanonicalAstError,
  CanonicalAstWarning,
  CanonicalBuildOptions,
  CanonicalBuildResult,
  CanonicalEndpoint,
  CanonicalSchema,
  CanonicalSecurityRequirement,
  CanonicalServer,
  CanonicalTag,
} from './types.js';
import { AstNormalizer } from './normalizer.js';

export class CanonicalAstBuilder {
  /**
   * Main entry point to build and normalize a CanonicalApiAst from an input specification.
   */
  public static build(input: unknown, _options?: CanonicalBuildOptions): CanonicalBuildResult {
    const errors: CanonicalAstError[] = [];
    const warnings: CanonicalAstWarning[] = [];

    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return {
        success: false,
        error: {
          code: 'MALFORMED_STRUCTURE',
          message: 'Input specification must be a non-null object.',
        },
        warnings,
      };
    }

    const doc = input as Record<string, unknown>;

    // 1. Info Normalization
    const info = AstNormalizer.normalizeInfo(doc.info, errors, warnings);
    if (errors.length > 0) {
      return {
        success: false,
        error: errors[0]!,
        warnings,
      };
    }

    // 2. Servers Normalization
    const servers: CanonicalServer[] = [];
    if (Array.isArray(doc.servers)) {
      for (const s of doc.servers) {
        if (typeof s === 'object' && s !== null && typeof s.url === 'string') {
          servers.push({
            url: s.url.trim(),
            description: typeof s.description === 'string' ? s.description.trim() : undefined,
            variables: typeof s.variables === 'object' ? (s.variables as CanonicalServer['variables']) : undefined,
          });
        }
      }
    }

    // 3. Tags Normalization
    const tags: CanonicalTag[] = [];
    if (Array.isArray(doc.tags)) {
      for (const t of doc.tags) {
        if (typeof t === 'object' && t !== null && typeof t.name === 'string') {
          tags.push({
            name: t.name.trim(),
            description: typeof t.description === 'string' ? t.description.trim() : undefined,
            externalDocs: typeof t.externalDocs === 'object' ? (t.externalDocs as CanonicalTag['externalDocs']) : undefined,
          });
        }
      }
    }

    // 4. Schemas Normalization (support both parsed components.schemas and direct schemas)
    const rawComponents = typeof doc.components === 'object' && doc.components !== null
      ? (doc.components as Record<string, unknown>)
      : {};

    const rawSchemas = (typeof doc.schemas === 'object' && doc.schemas !== null
      ? doc.schemas
      : (typeof rawComponents.schemas === 'object' && rawComponents.schemas !== null
        ? rawComponents.schemas
        : {})) as Record<string, unknown>;

    const schemas: Record<string, CanonicalSchema> = {};
    for (const [name, rawSchema] of Object.entries(rawSchemas)) {
      const schemaWithRef = typeof rawSchema === 'object' && rawSchema !== null && !('rawRef' in rawSchema)
        ? { rawRef: `#/components/schemas/${name}`, ...(rawSchema as Record<string, unknown>) }
        : rawSchema;
      schemas[name] = AstNormalizer.normalizeSchema(
        schemaWithRef,
        errors,
        warnings,
        new Set<string>()
      );
    }

    // 5. Security Schemes Normalization
    const rawSecuritySchemes = (typeof doc.securitySchemes === 'object' && doc.securitySchemes !== null
      ? doc.securitySchemes
      : (typeof rawComponents.securitySchemes === 'object' && rawComponents.securitySchemes !== null
        ? rawComponents.securitySchemes
        : {})) as Record<string, unknown>;

    const securitySchemes = AstNormalizer.normalizeSecuritySchemes(rawSecuritySchemes);

    // 6. Security Requirements
    const security: CanonicalSecurityRequirement[] = [];
    if (Array.isArray(doc.security)) {
      for (const s of doc.security) {
        if (typeof s === 'object' && s !== null) {
          const sObj = s as Record<string, unknown>;
          if (typeof sObj.name === 'string') {
            security.push({
              name: sObj.name,
              scopes: Array.isArray(sObj.scopes) ? (sObj.scopes as string[]) : [],
            });
          }
        }
      }
    }

    // 7. Endpoints Normalization & Invariant Checks
    const endpoints: CanonicalEndpoint[] = [];
    const seenEndpointIds = new Set<string>();

    // Support both pre-extracted endpoints array and raw paths dictionary
    if (Array.isArray(doc.endpoints)) {
      for (const rawEp of doc.endpoints) {
        const ep = AstNormalizer.normalizeEndpoint(rawEp, seenEndpointIds, errors, warnings);
        if (ep) {
          endpoints.push(ep);
        }
      }
    } else if (typeof doc.paths === 'object' && doc.paths !== null) {
      for (const [pathKey, pathItem] of Object.entries(doc.paths as Record<string, unknown>)) {
        if (typeof pathItem !== 'object' || pathItem === null) continue;
        const pObj = pathItem as Record<string, unknown>;
        const pathLevelParams = Array.isArray(pObj.parameters) ? pObj.parameters : [];

        for (const [methodKey, opVal] of Object.entries(pObj)) {
          const method = AstNormalizer.normalizeMethod(methodKey);
          if (!method || typeof opVal !== 'object' || opVal === null) continue;

          const op = opVal as Record<string, unknown>;
          const opParams = Array.isArray(op.parameters) ? op.parameters : [];

          const ep = AstNormalizer.normalizeEndpoint(
            {
              path: pathKey,
              method,
              operationId: op.operationId,
              summary: op.summary,
              description: op.description,
              deprecated: op.deprecated,
              tags: op.tags,
              parameters: [...pathLevelParams, ...opParams],
              requestBody: op.requestBody,
              responses: op.responses,
              security: op.security,
            },
            seenEndpointIds,
            errors,
            warnings
          );

          if (ep) {
            endpoints.push(ep);
          }
        }
      }
    }

    // Check if critical invariant errors occurred
    if (errors.length > 0) {
      return {
        success: false,
        error: errors[0]!,
        warnings,
      };
    }

    // 8. Deterministic Spec ID Generation
    const cleanTitle = info.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cleanVersion = info.version.toLowerCase().replace(/[^a-z0-9._-]+/g, '');
    const specId = `${cleanTitle || 'api'}:${cleanVersion || 'v1'}`;

    const rawFormat = (doc.rawFormat === 'yaml' || doc.format === 'yaml') ? 'yaml' : 'json';
    const specVersionStr = (doc.specVersion === '3.1' ? '3.1' : (doc.specVersion === '2.0' ? '2.0' : '3.0'));

    const ast: CanonicalApiAst = {
      id: specId,
      version: info.version,
      title: info.title,
      specVersion: specVersionStr,
      format: rawFormat,
      rawFormat,
      info,
      servers,
      tags,
      endpoints,
      schemas,
      securitySchemes,
      security,
      metadata: {
        normalizedAt: new Date().toISOString(),
        parsedAt: typeof doc.metadata === 'object' && doc.metadata !== null && 'parsedAt' in doc.metadata
          ? (doc.metadata as Record<string, unknown>).parsedAt as string
          : new Date().toISOString(),
        sourceFormat: rawFormat,
        specVersion: specVersionStr,
        sourceHash: typeof doc.metadata === 'object' && doc.metadata !== null && 'sourceHash' in doc.metadata
          ? (doc.metadata as Record<string, unknown>).sourceHash as string | undefined
          : undefined,
        totalEndpoints: endpoints.length,
        totalSchemas: Object.keys(schemas).length,
      },
    };

    return {
      success: true,
      data: ast,
      warnings,
    };
  }
}

/**
 * Builds a CanonicalApiAst from an input specification.
 */
export function buildCanonicalAst(input: unknown, options?: CanonicalBuildOptions): CanonicalBuildResult {
  return CanonicalAstBuilder.build(input, options);
}

/**
 * Alias for buildCanonicalAst.
 */
export function normalizeToCanonicalAst(input: unknown, options?: CanonicalBuildOptions): CanonicalBuildResult {
  return CanonicalAstBuilder.build(input, options);
}
