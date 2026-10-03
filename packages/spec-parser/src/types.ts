/**
 * @helios/spec-parser
 * Strong TypeScript types for normalized OpenAPI 3.0 and 3.1 specifications,
 * diagnostics, warnings, and error hierarchies.
 */

import type { HttpMethod, ParameterLocation, SecuritySchemeType } from '@helios/canonical-ast';
import type { SourceLocation } from '@helios/shared';

export type ParserErrorCode =
  | 'SYNTAX_ERROR'
  | 'UNSUPPORTED_VERSION'
  | 'VALIDATION_ERROR'
  | 'REFERENCE_RESOLUTION_ERROR'
  | 'FILE_READ_ERROR';

export interface ParserError {
  code: ParserErrorCode;
  message: string;
  location?: SourceLocation;
  path?: string[];
  details?: unknown;
}

export interface ParserWarning {
  code: string;
  message: string;
  path?: string[];
  location?: SourceLocation;
}

export interface ParsedApiInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: { name?: string; url?: string; email?: string };
  license?: { name: string; url?: string };
}

export interface ParsedServer {
  url: string;
  description?: string;
  variables?: Record<string, { default: string; enum?: string[]; description?: string }>;
}

export interface ParsedTag {
  name: string;
  description?: string;
  externalDocs?: { description?: string; url: string };
}

export interface ParsedSchema {
  id?: string;
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  required?: string[];
  properties?: Record<string, ParsedSchema>;
  items?: ParsedSchema;
  oneOf?: ParsedSchema[];
  anyOf?: ParsedSchema[];
  allOf?: ParsedSchema[];
  enum?: unknown[];
  rawRef?: string;
  isCircular?: boolean;
  location?: SourceLocation;
}

export interface ParsedParameter {
  name: string;
  in: ParameterLocation;
  required: boolean;
  deprecated?: boolean;
  description?: string;
  schema?: ParsedSchema;
  location?: SourceLocation;
}

export interface ParsedMediaType {
  schema?: ParsedSchema;
  example?: unknown;
  examples?: Record<string, unknown>;
}

export interface ParsedRequestBody {
  description?: string;
  required: boolean;
  content: Record<string, ParsedMediaType>;
  location?: SourceLocation;
}

export interface ParsedHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: ParsedSchema;
}

export interface ParsedResponse {
  statusCode: string;
  description: string;
  headers?: Record<string, ParsedHeader>;
  content?: Record<string, ParsedMediaType>;
  location?: SourceLocation;
}

export interface ParsedSecurityRequirement {
  name: string;
  scopes: string[];
}

export interface ParsedSecurityScheme {
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

export interface ParsedEndpoint {
  id: string;
  path: string;
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  tags?: string[];
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: Record<string, ParsedResponse>;
  security?: ParsedSecurityRequirement[];
  servers?: ParsedServer[];
  location?: SourceLocation;
}

export interface ParsedComponents {
  schemas: Record<string, ParsedSchema>;
  securitySchemes: Record<string, ParsedSecurityScheme>;
  parameters: Record<string, ParsedParameter>;
  responses: Record<string, ParsedResponse>;
  requestBodies: Record<string, ParsedRequestBody>;
}

export interface ParsedSpecMetadata {
  parsedAt: string;
  sourceFormat: 'json' | 'yaml';
  specVersion: '3.0' | '3.1';
  sourceHash?: string;
  totalEndpoints: number;
  totalSchemas: number;
}

export interface ParsedOpenAPISpec {
  openapi: string;
  specVersion: '3.0' | '3.1';
  format: 'json' | 'yaml';
  info: ParsedApiInfo;
  servers: ParsedServer[];
  tags: ParsedTag[];
  endpoints: ParsedEndpoint[];
  components: ParsedComponents;
  security: ParsedSecurityRequirement[];
  metadata: ParsedSpecMetadata;
  rawDoc?: Record<string, unknown>;
}

export interface ParseOptions {
  validateSyntaxOnly?: boolean;
  resolveLocalReferences?: boolean;
  sourceFilePath?: string;
}

export type ParseResult =
  | {
      readonly success: true;
      readonly data: ParsedOpenAPISpec;
      readonly warnings: ParserWarning[];
    }
  | {
      readonly success: false;
      readonly error: ParserError;
      readonly warnings: ParserWarning[];
    };
