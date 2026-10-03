/**
 * @helios/security-engine
 * Public API for the Deterministic API Security Analysis Engine.
 * Provides static security checks, OWASP API Top 10 mappings, and transparent risk scoring.
 */

export type {
  SecuritySeverity,
  SecurityConfidence,
  SecurityCategory,
  OwaspApiCategory,
  SecurityFinding,
  SecurityEngineOptions,
  SecurityRuleContext,
  SecurityRule,
  SecurityAuditSummary,
  SecurityAuditResult,
} from './types.js';

export { SecurityEngine, runSecurityAudit } from './engine.js';

// Export rule sets
export {
  authRules,
  ruleMissingEffectiveSecurity,
  ruleExplicitPublicEndpoint,
  ruleUnusedSecurityScheme,
  ruleInsecureBasicAuth,
  ruleIncompleteOAuth2Config,
  ruleUndefinedSecurityScheme,
} from './rules/auth.js';

export {
  transportRules,
  ruleHttpServerUrl,
  ruleInsecureProductionServer,
  ruleSensitiveOperationOverHttp,
  ruleQueryApiKeyAuth,
} from './rules/transport.js';

export {
  dataExposureRules,
  ruleSensitiveFieldInResponse,
  ruleSensitiveFieldInRequest,
  DEFAULT_SENSITIVE_FIELD_NAMES,
} from './rules/data-exposure.js';

export {
  resourceRules,
  ruleUnpaginatedCollection,
  ruleArrayWithoutMaxItems,
  ruleStringWithoutMaxLength,
  ruleNumericWithoutBounds,
  ruleUnconstrainedFileUpload,
  DEFAULT_PAGINATION_KEYWORDS,
} from './rules/resource.js';
