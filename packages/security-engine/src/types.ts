/**
 * @helios/security-engine
 * Domain models for the Deterministic API Security Engine:
 * findings, severity, confidence ratings, categories, rule interfaces, and audit reports.
 */

import type { CanonicalApiAst } from '@helios/canonical-ast';
import type { Severity, SourceLocation } from '@helios/shared';

export type SecuritySeverity = Severity; // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

export type SecurityConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type SecurityCategory =
  | 'authentication'
  | 'authorization'
  | 'transport'
  | 'data-exposure'
  | 'resource-consumption'
  | 'configuration';

export type OwaspApiCategory =
  | 'API1:2023_BOLA'
  | 'API2:2023_BROKEN_AUTH'
  | 'API3:2023_BOPLA'
  | 'API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION'
  | 'API5:2023_BFLA'
  | 'API6:2023_UNRESTRICTED_ACCESS_SENSITIVE_BUSINESS_FLOWS'
  | 'API7:2023_SSRF'
  | 'API8:2023_SECURITY_MISCONFIGURATION'
  | 'API9:2023_IMPROPER_INVENTORY_MANAGEMENT'
  | 'API10:2023_UNSAFE_CONSUMPTION_OF_APIS';

export interface SecurityFinding {
  id: string; // Deterministic ID: "${ruleId}:${endpointId || target}:${subKey || ''}"
  ruleId: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  confidence: SecurityConfidence;
  category: SecurityCategory;
  owaspCategory?: OwaspApiCategory;
  endpointPath?: string;
  httpMethod?: string;
  location?: SourceLocation;
  remediation: string;
  isHeuristic?: boolean;
  evidence?: string;
}

export interface SecurityEngineOptions {
  sensitiveFieldNames?: string[];
  paginationKeywords?: string[];
  enabledRuleIds?: string[];
  disabledRuleIds?: string[];
}

export interface SecurityRuleContext {
  options: Required<SecurityEngineOptions>;
}

export interface SecurityRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultSeverity: SecuritySeverity;
  readonly confidence: SecurityConfidence;
  readonly category: SecurityCategory;
  readonly owaspCategory?: OwaspApiCategory;
  execute(ast: CanonicalApiAst, context: SecurityRuleContext): SecurityFinding[];
}

export interface SecurityAuditSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface SecurityAuditResult {
  specId: string;
  timestamp: string;
  findings: SecurityFinding[];
  score: number; // 0-100 deterministic security score
  summary: SecurityAuditSummary;
  owaspBreakdown: Record<string, number>;
}
