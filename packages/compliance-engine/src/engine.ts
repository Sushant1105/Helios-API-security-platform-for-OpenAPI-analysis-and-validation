/**
 * @helios/compliance-engine
 * Standard Compliance Engine implementation for HELIOS.
 * Deterministically evaluates API specifications against OWASP API Security 2023,
 * PCI-DSS v4.0, and HIPAA Security Rule safeguards.
 */

import type { HeliosSpec } from '@helios/canonical-ast';
import type { SecurityFinding, SecuritySeverity } from '@helios/security-engine';
import {
  COMPLIANCE_DISCLAIMER,
  type ComplianceControlMapping,
  type ComplianceEngine,
  type ComplianceReport,
  type ComplianceStandard,
  type RiskScoreBreakdown,
} from './index.js';

interface ControlDefinition {
  controlId: string;
  standard: ComplianceStandard;
  title: string;
  description: string;
  matchesFinding: (f: SecurityFinding) => boolean;
  evaluateStatus: (spec: HeliosSpec, matchedFindings: SecurityFinding[]) => 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'REQUIRES_MANUAL_REVIEW';
}

const CONTROL_DEFINITIONS: ControlDefinition[] = [
  // --- OWASP API Security Top 10 (2023) ---
  {
    controlId: 'API1:2023_BOLA',
    standard: 'OWASP_API_SECURITY_2023',
    title: 'Broken Object Level Authorization',
    description: 'Endpoints must enforce object-level access controls and require explicit authentication/authorization.',
    matchesFinding: (f) => f.ruleId === 'AUTH-001' || f.ruleId === 'AUTH-002' || f.owaspCategory === 'API1:2023_BOLA',
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'API2:2023_BROKEN_AUTH',
    standard: 'OWASP_API_SECURITY_2023',
    title: 'Broken Authentication',
    description: 'Authentication mechanisms must be robust, properly configured, and avoid plaintext or obsolete schemes.',
    matchesFinding: (f) =>
      ['AUTH-001', 'AUTH-004', 'AUTH-005', 'AUTH-006'].includes(f.ruleId) || f.owaspCategory === 'API2:2023_BROKEN_AUTH',
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'API3:2023_BOPLA',
    standard: 'OWASP_API_SECURITY_2023',
    title: 'Broken Object Property Level Authorization',
    description: 'Prevent exposure of sensitive object properties in requests and responses.',
    matchesFinding: (f) => f.ruleId.startsWith('DATA-') || f.owaspCategory === 'API3:2023_BOPLA',
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION',
    standard: 'OWASP_API_SECURITY_2023',
    title: 'Unrestricted Resource Consumption',
    description: 'Impose bounds on arrays, strings, numeric parameters, pagination, and file uploads.',
    matchesFinding: (f) => f.ruleId.startsWith('RSRC-') || f.owaspCategory === 'API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION',
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'API5:2023_BFLA',
    standard: 'OWASP_API_SECURITY_2023',
    title: 'Broken Function Level Authorization',
    description: 'Administrative and mutating operations must enforce strict function-level authorization.',
    matchesFinding: (f) =>
      (f.ruleId === 'AUTH-001' || f.ruleId === 'AUTH-002') &&
      Boolean(f.httpMethod && ['post', 'put', 'delete', 'patch'].includes(f.httpMethod.toLowerCase())),
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'API6:2023_UNRESTRICTED_ACCESS_SENSITIVE_BUSINESS_FLOWS',
    standard: 'OWASP_API_SECURITY_2023',
    title: 'Unrestricted Access to Sensitive Business Flows',
    description: 'Ensure automated abuse and mass operations are mitigated with rate limiting and pagination.',
    matchesFinding: (f) => f.ruleId === 'RSRC-001' || f.owaspCategory === 'API6:2023_UNRESTRICTED_ACCESS_SENSITIVE_BUSINESS_FLOWS',
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'API7:2023_SSRF',
    standard: 'OWASP_API_SECURITY_2023',
    title: 'Server-Side Request Forgery',
    description: 'Validate and sanitize URL or target parameters that could induce server-side outbound requests.',
    matchesFinding: (f) => f.owaspCategory === 'API7:2023_SSRF',
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'API8:2023_SECURITY_MISCONFIGURATION',
    standard: 'OWASP_API_SECURITY_2023',
    title: 'Security Misconfiguration',
    description: 'Avoid unencrypted HTTP transport, insecure server definitions, or unused security schemes.',
    matchesFinding: (f) =>
      ['TRNS-001', 'TRNS-002', 'AUTH-003'].includes(f.ruleId) || f.owaspCategory === 'API8:2023_SECURITY_MISCONFIGURATION',
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'COMPLIANT'),
  },
  {
    controlId: 'API9:2023_IMPROPER_INVENTORY_MANAGEMENT',
    standard: 'OWASP_API_SECURITY_2023',
    title: 'Improper Inventory Management',
    description: 'Track all endpoints, versioning, deprecated interfaces, and ensure documentation consistency.',
    matchesFinding: (f) => f.owaspCategory === 'API9:2023_IMPROPER_INVENTORY_MANAGEMENT',
    evaluateStatus: (spec, matched) => {
      if (matched.length > 0) return 'NON_COMPLIANT';
      const hasDeprecated = spec.endpoints.some((e) => e.deprecated);
      return hasDeprecated ? 'REQUIRES_MANUAL_REVIEW' : 'COMPLIANT';
    },
  },
  {
    controlId: 'API10:2023_UNSAFE_CONSUMPTION_OF_APIS',
    standard: 'OWASP_API_SECURITY_2023',
    title: 'Unsafe Consumption of APIs',
    description: 'Ensure credentials and API keys are not leaked via query strings or insecure channels.',
    matchesFinding: (f) => f.ruleId === 'TRNS-004' || f.owaspCategory === 'API10:2023_UNSAFE_CONSUMPTION_OF_APIS',
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'COMPLIANT'),
  },

  // --- PCI-DSS v4.0 Technical Controls ---
  {
    controlId: 'PCI-4.2.1',
    standard: 'PCI_DSS_V4_TECHNICAL_CONTROLS',
    title: 'Strong Cryptography for Transmission Over Open Networks',
    description: 'All transmissions containing sensitive or cardholder data over public networks must use strong cryptography (HTTPS/TLS).',
    matchesFinding: (f) => ['TRNS-001', 'TRNS-002', 'TRNS-003'].includes(f.ruleId),
    evaluateStatus: (spec, matched) => {
      if (matched.length > 0) return 'NON_COMPLIANT';
      const hasHttpServer = spec.servers.some((s) => s.url.startsWith('http://'));
      return hasHttpServer ? 'NON_COMPLIANT' : 'COMPLIANT';
    },
  },
  {
    controlId: 'PCI-6.4.1',
    standard: 'PCI_DSS_V4_TECHNICAL_CONTROLS',
    title: 'Public Web Applications Protected Against Known Attacks',
    description: 'Public-facing APIs must address common vulnerabilities including OWASP API Top 10.',
    matchesFinding: (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH',
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'PCI-8.3.1',
    standard: 'PCI_DSS_V4_TECHNICAL_CONTROLS',
    title: 'Strong Authentication for Cardholder Data Environment Access',
    description: 'Require strong authentication for all access to endpoints handling cardholder data.',
    matchesFinding: (f) => ['AUTH-001', 'AUTH-004'].includes(f.ruleId),
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'PCI-3.4.1',
    standard: 'PCI_DSS_V4_TECHNICAL_CONTROLS',
    title: 'PAN Masking & Sensitive Data Protection',
    description: 'Cardholder PAN and sensitive authentication data must be rendered unreadable and minimized.',
    matchesFinding: (f) => f.ruleId.startsWith('DATA-'),
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },

  // --- HIPAA Security Rule Technical Safeguards ---
  {
    controlId: 'HIPAA-164.312(a)(1)',
    standard: 'HIPAA_SECURITY_RULE_TECHNICAL_SAFEGUARDS',
    title: 'Access Control (Technical Safeguards)',
    description: 'Implement technical policies that allow only authorized persons or software programs to access ePHI.',
    matchesFinding: (f) => ['AUTH-001', 'AUTH-002', 'AUTH-004'].includes(f.ruleId),
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'HIPAA-164.312(e)(1)',
    standard: 'HIPAA_SECURITY_RULE_TECHNICAL_SAFEGUARDS',
    title: 'Transmission Security (Encryption in Transit)',
    description: 'Guard against unauthorized access to ePHI being transmitted over an electronic communications network.',
    matchesFinding: (f) => ['TRNS-001', 'TRNS-002', 'TRNS-003'].includes(f.ruleId),
    evaluateStatus: (spec, matched) => {
      if (matched.length > 0) return 'NON_COMPLIANT';
      const hasHttpServer = spec.servers.some((s) => s.url.startsWith('http://'));
      return hasHttpServer ? 'NON_COMPLIANT' : 'COMPLIANT';
    },
  },
  {
    controlId: 'HIPAA-164.312(c)(1)',
    standard: 'HIPAA_SECURITY_RULE_TECHNICAL_SAFEGUARDS',
    title: 'Integrity Controls for ePHI',
    description: 'Implement policies and procedures to protect electronic protected health information from improper alteration or destruction.',
    matchesFinding: (f) => f.ruleId.startsWith('DATA-'),
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
  {
    controlId: 'HIPAA-164.312(b)',
    standard: 'HIPAA_SECURITY_RULE_TECHNICAL_SAFEGUARDS',
    title: 'Audit Controls',
    description: 'Implement hardware, software, and procedural mechanisms that record and examine activity in information systems.',
    matchesFinding: (f) => ['AUTH-003', 'RSRC-001'].includes(f.ruleId),
    evaluateStatus: (_, matched) => (matched.length > 0 ? 'NON_COMPLIANT' : 'REQUIRES_MANUAL_REVIEW'),
  },
];

const SEVERITY_DEDUCTIONS: Record<SecuritySeverity, number> = {
  CRITICAL: 25,
  HIGH: 15,
  MEDIUM: 7,
  LOW: 2,
  INFO: 0,
};

export class StandardComplianceEngine implements ComplianceEngine {
  public evaluate(spec: HeliosSpec, findings: SecurityFinding[]): ComplianceReport {
    const mappings: ComplianceControlMapping[] = [];

    for (const def of CONTROL_DEFINITIONS) {
      const matched = findings.filter((f) => def.matchesFinding(f));
      const status = def.evaluateStatus(spec, matched);

      mappings.push({
        controlId: def.controlId,
        standard: def.standard,
        title: def.title,
        description: def.description,
        matchedFindings: matched,
        status,
      });
    }

    // Deterministic sort: standard -> controlId
    mappings.sort((a, b) => {
      const stdDiff = a.standard.localeCompare(b.standard);
      if (stdDiff !== 0) return stdDiff;
      return a.controlId.localeCompare(b.controlId);
    });

    const riskScore = this.calculateRiskScore(findings);

    return {
      timestamp: new Date().toISOString(),
      disclaimer: COMPLIANCE_DISCLAIMER,
      riskScore,
      mappings,
    };
  }

  public calculateRiskScore(findings: SecurityFinding[]): RiskScoreBreakdown {
    const categoryDeductions = {
      authentication: 0,
      authorization: 0,
      dataProtection: 0,
      inputValidation: 0,
      configuration: 0,
    };

    for (const f of findings) {
      const deduction = SEVERITY_DEDUCTIONS[f.severity] || 0;
      if (f.category === 'authentication') {
        categoryDeductions.authentication += deduction;
      } else if (f.category === 'authorization') {
        categoryDeductions.authorization += deduction;
      } else if (f.category === 'data-exposure' || f.category === 'transport') {
        categoryDeductions.dataProtection += deduction;
      } else if (f.category === 'resource-consumption') {
        categoryDeductions.inputValidation += deduction;
      } else {
        categoryDeductions.configuration += deduction;
      }
    }

    const categoryScores = {
      authentication: Math.max(0, 100 - categoryDeductions.authentication),
      authorization: Math.max(0, 100 - categoryDeductions.authorization),
      dataProtection: Math.max(0, 100 - categoryDeductions.dataProtection),
      inputValidation: Math.max(0, 100 - categoryDeductions.inputValidation),
      configuration: Math.max(0, 100 - categoryDeductions.configuration),
    };

    const weightingsApplied = {
      authentication: 0.30,
      dataProtection: 0.25,
      authorization: 0.20,
      inputValidation: 0.15,
      configuration: 0.10,
    };

    const rawOverall =
      categoryScores.authentication * weightingsApplied.authentication +
      categoryScores.dataProtection * weightingsApplied.dataProtection +
      categoryScores.authorization * weightingsApplied.authorization +
      categoryScores.inputValidation * weightingsApplied.inputValidation +
      categoryScores.configuration * weightingsApplied.configuration;

    const overallScore = Math.max(0, Math.min(100, Math.round(rawOverall)));

    return {
      overallScore,
      categoryScores,
      weightingsApplied,
      formulaDescription:
        'Weighted composite score (Auth: 30%, Data Protection: 25%, AuthZ: 20%, Input Validation: 15%, Configuration: 10%) with severity deductions (Critical: -25, High: -15, Medium: -7, Low: -2).',
    };
  }
}

export function evaluateCompliance(spec: HeliosSpec, findings: SecurityFinding[]): ComplianceReport {
  const engine = new StandardComplianceEngine();
  return engine.evaluate(spec, findings);
}

export function calculateRiskScore(findings: SecurityFinding[]): RiskScoreBreakdown {
  const engine = new StandardComplianceEngine();
  return engine.calculateRiskScore(findings);
}
