/**
 * @helios/canonical-ast
 * Strongly-typed domain models for the HELIOS Canonical Intermediate Representation (AST).
 * Provides version-agnostic, normalized structures for APIs, schemas, endpoints, and security.
 */

import type { SourceLocation } from '@helios/shared';

export type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'options'
  | 'head'
  | 'trace';

export type ParameterLocation = 'query' | 'header' | 'path' | 'cookie';

export type SecuritySchemeType =
  | 'apiKey'
  | 'http'
  | 'oauth2'
  | 'openIdConnect'
  | 'mutualTLS';

export type CanonicalAstErrorCode =
  | 'INVALID_INVARIANT'
  | 'DUPLICATE_ENDPOINT'
  | 'MALFORMED_STRUCTURE'
  | 'INVALID_STATUS_CODE'
  | 'UNRESOLVED_REFERENCE';

export interface CanonicalAstError {
  code: CanonicalAstErrorCode;
  message: string;
  path?: string[];
  location?: SourceLocation;
  details?: unknown;
}

export interface CanonicalAstWarning {
  code: string;
  message: string;
  path?: string[];
  location?: SourceLocation;
}

export interface CanonicalContact {
  name?: string;
  url?: string;
  email?: string;
}

export interface CanonicalLicense {
  name: string;
  url?: string;
}

export interface CanonicalInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: CanonicalContact;
  license?: CanonicalLicense;
}

export interface CanonicalServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

export interface CanonicalServer {
  url: string;
  description?: string;
  variables?: Record<string, CanonicalServerVariable>;
}

export interface CanonicalTag {
  name: string;
  description?: string;
  externalDocs?: { description?: string; url: string };
}

export interface CanonicalProperty {
  name: string;
  schema: CanonicalSchema;
  required: boolean;
  description?: string;
}

export interface CanonicalSchema {
  id?: string;
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  nullable: boolean;
  readOnly: boolean;
  writeOnly: boolean;
  deprecated: boolean;
  requiredProperties: string[];
  properties?: Record<string, CanonicalProperty>;
  items?: CanonicalSchema;
  additionalProperties?: boolean | CanonicalSchema;
  oneOf?: CanonicalSchema[];
  anyOf?: CanonicalSchema[];
  allOf?: CanonicalSchema[];
  enum?: unknown[];
  example?: unknown;
  examples?: unknown[];
  maxLength?: number;
  minLength?: number;
  maxItems?: number;
  minItems?: number;
  minimum?: number;
  maximum?: number;
  rawRef?: string;
  isCircular?: boolean;
  location?: SourceLocation;
}

export interface CanonicalParameter {
  name: string;
  in: ParameterLocation;
  required: boolean;
  deprecated: boolean;
  description?: string;
  schema?: CanonicalSchema;
  location?: SourceLocation;
}

export interface CanonicalMediaType {
  schema?: CanonicalSchema;
  example?: unknown;
  examples?: Record<string, unknown>;
}

export interface CanonicalRequestBody {
  description?: string;
  required: boolean;
  content: Record<string, CanonicalMediaType>;
  location?: SourceLocation;
}

export interface CanonicalHeader {
  description?: string;
  required: boolean;
  deprecated: boolean;
  schema?: CanonicalSchema;
}

export interface CanonicalResponse {
  statusCode: string;
  description: string;
  headers?: Record<string, CanonicalHeader>;
  content?: Record<string, CanonicalMediaType>;
  location?: SourceLocation;
}

export interface CanonicalSecurityRequirement {
  name: string;
  scopes: string[];
}

export interface CanonicalSecurityScheme {
  id: string;
  type: SecuritySchemeType;
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, unknown>;
  openIdConnectUrl?: string;
  location?: SourceLocation;
}

export interface CanonicalEndpoint {
  id: string; // Deterministic stable identity: e.g. "get:/users/{id}"
  path: string; // Normalized path with leading slash, trimmed
  method: HttpMethod; // Lowercase
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated: boolean;
  tags: string[];
  parameters: CanonicalParameter[];
  requestBody?: CanonicalRequestBody;
  responses: Record<string, CanonicalResponse>;
  security?: CanonicalSecurityRequirement[];
  servers?: CanonicalServer[];
  location?: SourceLocation;
}

export interface CanonicalMetadata {
  normalizedAt: string;
  parsedAt?: string;
  sourceFormat: 'json' | 'yaml';
  specVersion: '3.0' | '3.1' | '2.0';
  sourceHash?: string;
  totalEndpoints: number;
  totalSchemas: number;
}

export interface CanonicalApiAst {
  id: string; // Deterministic stable specification identifier
  version: string;
  title: string;
  specVersion: '3.0' | '3.1' | '2.0';
  format: 'json' | 'yaml';
  rawFormat?: 'json' | 'yaml';
  info: CanonicalInfo;
  servers: CanonicalServer[];
  tags: CanonicalTag[];
  endpoints: CanonicalEndpoint[];
  schemas: Record<string, CanonicalSchema>;
  securitySchemes: Record<string, CanonicalSecurityScheme>;
  security: CanonicalSecurityRequirement[];
  metadata: CanonicalMetadata;
}

export interface CanonicalBuildOptions {
  strictInvariants?: boolean;
}

export type CanonicalBuildResult =
  | {
      readonly success: true;
      readonly data: CanonicalApiAst;
      readonly warnings: CanonicalAstWarning[];
    }
  | {
      readonly success: false;
      readonly error: CanonicalAstError;
      readonly warnings: CanonicalAstWarning[];
    };
