/**
 * @helios/diff-engine
 * Strongly-typed domain models for the Semantic API Diff Engine.
 */

import type { HttpMethod } from '@helios/canonical-ast';

export type CompatibilityImpact =
  | 'breaking'
  | 'potentially_breaking'
  | 'non_breaking';

// Legacy compatibility alias
export type ChangeClassification = 'BREAKING' | 'POTENTIALLY_BREAKING' | 'NON_BREAKING';

export type ChangeCategory =
  | 'metadata'
  | 'endpoint'
  | 'parameter'
  | 'request_body'
  | 'response'
  | 'schema'
  | 'security';

export type ChangeKind =
  // Metadata
  | 'API_TITLE_CHANGED'
  | 'API_VERSION_CHANGED'
  | 'API_DESCRIPTION_CHANGED'
  | 'SERVER_ADDED'
  | 'SERVER_REMOVED'
  | 'SERVER_MODIFIED'
  | 'TAG_ADDED'
  | 'TAG_REMOVED'
  // Endpoints
  | 'ENDPOINT_ADDED'
  | 'ENDPOINT_REMOVED'
  | 'OPERATION_ID_CHANGED'
  | 'ENDPOINT_DEPRECATED'
  | 'ENDPOINT_UNDECORATED'
  // Parameters
  | 'PARAMETER_ADDED'
  | 'PARAMETER_REMOVED'
  | 'PARAMETER_REQUIRED_CHANGED'
  | 'PARAMETER_TYPE_CHANGED'
  | 'PARAMETER_FORMAT_CHANGED'
  | 'PARAMETER_CONSTRAINT_CHANGED'
  | 'PARAMETER_ENUM_CHANGED'
  | 'PARAMETER_DEFAULT_CHANGED'
  // Request Bodies
  | 'REQUEST_BODY_ADDED'
  | 'REQUEST_BODY_REMOVED'
  | 'REQUEST_BODY_REQUIRED_CHANGED'
  | 'REQUEST_MEDIA_TYPE_ADDED'
  | 'REQUEST_MEDIA_TYPE_REMOVED'
  // Responses
  | 'RESPONSE_STATUS_ADDED'
  | 'RESPONSE_STATUS_REMOVED'
  | 'RESPONSE_MEDIA_TYPE_ADDED'
  | 'RESPONSE_MEDIA_TYPE_REMOVED'
  | 'RESPONSE_HEADER_ADDED'
  | 'RESPONSE_HEADER_REMOVED'
  // Schemas
  | 'SCHEMA_ADDED'
  | 'SCHEMA_REMOVED'
  | 'SCHEMA_PROPERTY_ADDED'
  | 'SCHEMA_PROPERTY_REMOVED'
  | 'SCHEMA_PROPERTY_REQUIRED_CHANGED'
  | 'SCHEMA_TYPE_CHANGED'
  | 'SCHEMA_NULLABLE_CHANGED'
  | 'SCHEMA_ENUM_CHANGED'
  | 'SCHEMA_CONSTRAINT_CHANGED'
  | 'SCHEMA_READ_ONLY_CHANGED'
  | 'SCHEMA_WRITE_ONLY_CHANGED'
  | 'SCHEMA_DISCRIMINATOR_CHANGED'
  // Security
  | 'SECURITY_REQUIREMENT_ADDED'
  | 'SECURITY_REQUIREMENT_REMOVED'
  | 'SECURITY_REQUIREMENT_CHANGED'
  | 'SECURITY_SCHEME_ADDED'
  | 'SECURITY_SCHEME_REMOVED'
  | 'SECURITY_SCHEME_MODIFIED'
  | 'SECURITY_SCOPE_ADDED'
  | 'SECURITY_SCOPE_REMOVED';

export interface ApiChange {
  id: string; // Deterministic stable identifier: e.g. "endpoint:get:/users:ENDPOINT_ADDED"
  kind: ChangeKind;
  category: ChangeCategory;
  compatibility: CompatibilityImpact;
  message: string;
  path?: string;
  method?: HttpMethod;
  location?: string;
  rationale: string;
  oldValue?: unknown;
  newValue?: unknown;
  isSecurityRelevant?: boolean;
}

export interface DiffConfiguration {
  /**
   * Compatibility impact when a property is removed from a response schema.
   * Default: 'breaking'
   */
  responsePropertyRemovalImpact?: CompatibilityImpact;

  /**
   * Compatibility impact when an enum variant is added to a response schema.
   * Default: 'potentially_breaking' (client parsers might reject unrecognized enums)
   */
  responseEnumAdditionImpact?: CompatibilityImpact;

  /**
   * Compatibility impact when an operationId is modified.
   * Default: 'non_breaking' (or 'potentially_breaking' for strict SDK consumers)
   */
  operationIdChangeImpact?: CompatibilityImpact;

  /**
   * Compatibility impact when authentication requirement is removed from an endpoint.
   * Default: 'non_breaking' (protocol invocation remains valid, but security flagged)
   */
  unauthenticatedEndpointImpact?: CompatibilityImpact;

  /**
   * Whether to include API metadata changes (title, version, servers, tags).
   * Default: true
   */
  includeMetadataChanges?: boolean;

  /**
   * Whether to perform strict numerical and string bound constraint diffing.
   * Default: true
   */
  strictConstraintChecking?: boolean;

  /**
   * Whether to ignore cosmetic documentation/description changes.
   * Default: true
   */
  ignoreDescriptionChanges?: boolean;
}

export interface DiffSummary {
  totalChanges: number;
  breaking: number;
  potentiallyBreaking: number;
  nonBreaking: number;
  securityRelevant: number;
  byCategory: Record<ChangeCategory, number>;
}

export interface DiffResult {
  baseVersion: string;
  targetVersion: string;
  hasBreakingChanges: boolean;
  summary: DiffSummary;
  changes: ApiChange[];
  configurationApplied: Required<DiffConfiguration>;
}

export interface SchemaCompareContext {
  path?: string;
  method?: HttpMethod;
  location: string;
  direction: 'request' | 'response' | 'standalone';
  config: Required<DiffConfiguration>;
  visitedPairs: Set<string>;
}
