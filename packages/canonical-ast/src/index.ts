/**
 * @helios/canonical-ast
 * Canonical Intermediate Representation (AST) for OpenAPI specifications.
 * Neutralizes differences between OpenAPI 2.0 (Swagger), 3.0, and 3.1 dialects.
 */

// Export domain types and interfaces
export type {
  HttpMethod,
  ParameterLocation,
  SecuritySchemeType,
  CanonicalAstErrorCode,
  CanonicalAstError,
  CanonicalAstWarning,
  CanonicalContact,
  CanonicalLicense,
  CanonicalInfo,
  CanonicalServerVariable,
  CanonicalServer,
  CanonicalTag,
  CanonicalProperty,
  CanonicalSchema,
  CanonicalParameter,
  CanonicalMediaType,
  CanonicalRequestBody,
  CanonicalHeader,
  CanonicalResponse,
  CanonicalSecurityRequirement,
  CanonicalSecurityScheme,
  CanonicalEndpoint,
  CanonicalMetadata,
  CanonicalApiAst,
  CanonicalBuildOptions,
  CanonicalBuildResult,
} from './types.js';

// Export normalization utilities and constants
export {
  AstNormalizer,
  VALID_HTTP_METHODS,
} from './normalizer.js';

// Export canonical builder and factory functions
export {
  CanonicalAstBuilder,
  buildCanonicalAst,
  normalizeToCanonicalAst,
} from './builder.js';

// Backward compatibility type aliases for seamless integration with Phase 0/Phase 1
import type {
  CanonicalApiAst,
  CanonicalContact,
  CanonicalEndpoint,
  CanonicalHeader,
  CanonicalInfo,
  CanonicalLicense,
  CanonicalMediaType,
  CanonicalMetadata,
  CanonicalParameter,
  CanonicalProperty,
  CanonicalRequestBody,
  CanonicalResponse,
  CanonicalSchema,
  CanonicalSecurityRequirement,
  CanonicalSecurityScheme,
  CanonicalServer,
  CanonicalServerVariable,
  CanonicalTag,
} from './types.js';

export type HeliosContact = CanonicalContact;
export type HeliosLicense = CanonicalLicense;
export type HeliosInfo = CanonicalInfo;
export type HeliosServerVariable = CanonicalServerVariable;
export type HeliosServer = CanonicalServer;
export type HeliosTag = CanonicalTag;
export type HeliosProperty = CanonicalProperty;
export type HeliosSchema = CanonicalSchema;
export type HeliosParameter = CanonicalParameter;
export type HeliosMediaType = CanonicalMediaType;
export type HeliosRequestBody = CanonicalRequestBody;
export type HeliosHeader = CanonicalHeader;
export type HeliosResponse = CanonicalResponse;
export type HeliosSecurityRequirement = CanonicalSecurityRequirement;
export type HeliosEndpoint = CanonicalEndpoint;
export type HeliosSecurityScheme = CanonicalSecurityScheme;
export type HeliosMetadata = CanonicalMetadata;
export type HeliosSpec = CanonicalApiAst;
