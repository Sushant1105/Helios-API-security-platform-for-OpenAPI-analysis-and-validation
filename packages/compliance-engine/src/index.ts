/**
 * @helios/compliance-engine
 * Deterministic compliance mapping and transparent risk score calculation.
 * Maps AST checks and security findings to OWASP API Security, PCI-DSS, and HIPAA categories.
 */

import type { HeliosSpec } from '@helios/canonical-ast';
import type { SecurityFinding } from '@helios/security-engine';

export const COMPLIANCE_DISCLAIMER =
  'HELIOS automated compliance mappings provide technical control indicators only and do NOT constitute formal PCI-DSS, HIPAA, or statutory compliance certification.';

export type ComplianceStandard =
  | 'OWASP_API_SECURITY_2023'
  | 'PCI_DSS_V4_TECHNICAL_CONTROLS'
  | 'HIPAA_SECURITY_RULE_TECHNICAL_SAFEGUARDS';

export interface ComplianceControlMapping {
  controlId: string;
  standard: ComplianceStandard;
  title: string;
  description: string;
  matchedFindings: SecurityFinding[];
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'REQUIRES_MANUAL_REVIEW';
}

export interface RiskScoreBreakdown {
  overallScore: number; // 0 (critical risk) - 100 (optimal posture)
  categoryScores: {
    authentication: number;
    authorization: number;
    dataProtection: number;
    inputValidation: number;
    configuration: number;
  };
  weightingsApplied: Record<string, number>;
  formulaDescription: string;
}

export interface ComplianceReport {
  timestamp: string;
  disclaimer: string;
  riskScore: RiskScoreBreakdown;
  mappings: ComplianceControlMapping[];
}

export interface ComplianceEngine {
  evaluate(spec: HeliosSpec, findings: SecurityFinding[]): ComplianceReport;
  calculateRiskScore(findings: SecurityFinding[]): RiskScoreBreakdown;
}

export { StandardComplianceEngine, evaluateCompliance, calculateRiskScore } from './engine.js';

