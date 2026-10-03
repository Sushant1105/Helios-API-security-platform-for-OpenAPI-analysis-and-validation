/**
 * @helios/security-engine
 * Core Security Analysis Engine orchestrating deterministic security rules,
 * finding deduplication, deterministic sorting, risk score calculation, and OWASP mapping.
 */

import type { CanonicalApiAst } from '@helios/canonical-ast';
import type {
  SecurityAuditResult,
  SecurityAuditSummary,
  SecurityConfidence,
  SecurityEngineOptions,
  SecurityFinding,
  SecurityRule,
  SecurityRuleContext,
  SecuritySeverity,
} from './types.js';
import { authRules } from './rules/auth.js';
import { transportRules } from './rules/transport.js';
import { dataExposureRules, DEFAULT_SENSITIVE_FIELD_NAMES } from './rules/data-exposure.js';
import { resourceRules, DEFAULT_PAGINATION_KEYWORDS } from './rules/resource.js';

const SEVERITY_RANK: Record<SecuritySeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

const CONFIDENCE_RANK: Record<SecurityConfidence, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

const SEVERITY_SCORE_DEDUCTIONS: Record<SecuritySeverity, number> = {
  CRITICAL: 25,
  HIGH: 15,
  MEDIUM: 7,
  LOW: 2,
  INFO: 0,
};

export class SecurityEngine {
  private rules: Map<string, SecurityRule> = new Map();

  constructor() {
    this.registerDefaultRules();
  }

  /**
   * Registers all built-in rules across authentication, transport, data-exposure, and resource consumption.
   */
  public registerDefaultRules(): void {
    const allRules: SecurityRule[] = [
      ...authRules,
      ...transportRules,
      ...dataExposureRules,
      ...resourceRules,
    ];
    for (const rule of allRules) {
      this.registerRule(rule);
    }
  }

  /**
   * Registers a custom or standard security rule.
   */
  public registerRule(rule: SecurityRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Clears all registered rules.
   */
  public clearRules(): void {
    this.rules.clear();
  }

  /**
   * Runs a complete deterministic security audit against a CanonicalApiAst.
   */
  public runAudit(
    ast: CanonicalApiAst,
    options: SecurityEngineOptions = {}
  ): SecurityAuditResult {
    const context: SecurityRuleContext = {
      options: {
        sensitiveFieldNames: options.sensitiveFieldNames && options.sensitiveFieldNames.length > 0
          ? options.sensitiveFieldNames
          : DEFAULT_SENSITIVE_FIELD_NAMES,
        paginationKeywords: options.paginationKeywords && options.paginationKeywords.length > 0
          ? options.paginationKeywords
          : DEFAULT_PAGINATION_KEYWORDS,
        enabledRuleIds: options.enabledRuleIds || [],
        disabledRuleIds: options.disabledRuleIds || [],
      },
    };

    const rawFindings: SecurityFinding[] = [];
    const enabledSet = options.enabledRuleIds && options.enabledRuleIds.length > 0
      ? new Set(options.enabledRuleIds)
      : null;
    const disabledSet = new Set(options.disabledRuleIds || []);

    for (const rule of this.rules.values()) {
      if (disabledSet.has(rule.id)) continue;
      if (enabledSet && !enabledSet.has(rule.id)) continue;

      try {
        const ruleFindings = rule.execute(ast, context);
        rawFindings.push(...ruleFindings);
      } catch (err) {
        // Deterministic engine should avoid uncaught exceptions from individual rules
        rawFindings.push({
          id: `SEC-ERR:${rule.id}`,
          ruleId: rule.id,
          title: `Rule Execution Error in ${rule.name}`,
          description: `Internal error during rule evaluation: ${err instanceof Error ? err.message : String(err)}`,
          severity: 'INFO',
          confidence: 'LOW',
          category: 'configuration',
          remediation: 'Inspect specification structure.',
        });
      }
    }

    return this.finalizeAuditResult(ast.id, rawFindings);
  }

  /**
   * Deduplicates findings, applies deterministic sorting, calculates risk scores, and aggregates OWASP categories.
   */
  private finalizeAuditResult(specId: string, rawFindings: SecurityFinding[]): SecurityAuditResult {
    // 1. Deduplicate findings by unique ID
    const uniqueMap = new Map<string, SecurityFinding>();
    for (const f of rawFindings) {
      if (!uniqueMap.has(f.id)) {
        uniqueMap.set(f.id, f);
      }
    }

    const findings = Array.from(uniqueMap.values());

    // 2. Deterministic sort:
    // Primary: Severity rank (CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO)
    // Secondary: Confidence rank (HIGH -> MEDIUM -> LOW)
    // Tertiary: Category alphabetically
    // Quaternary: Endpoint path or target alphabetically
    // Quinary: Rule ID alphabetically
    // Senary: Finding ID alphabetically
    findings.sort((a, b) => {
      const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sevDiff !== 0) return sevDiff;

      const confDiff = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
      if (confDiff !== 0) return confDiff;

      const catDiff = a.category.localeCompare(b.category);
      if (catDiff !== 0) return catDiff;

      const targetA = a.endpointPath || a.id;
      const targetB = b.endpointPath || b.id;
      const targetDiff = targetA.localeCompare(targetB);
      if (targetDiff !== 0) return targetDiff;

      const ruleDiff = a.ruleId.localeCompare(b.ruleId);
      if (ruleDiff !== 0) return ruleDiff;

      return a.id.localeCompare(b.id);
    });

    // 3. Compute summary counts and OWASP category breakdown
    const summary: SecurityAuditSummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: findings.length,
    };

    const owaspBreakdown: Record<string, number> = {};
    let totalDeductions = 0;

    for (const f of findings) {
      if (f.severity === 'CRITICAL') summary.critical++;
      else if (f.severity === 'HIGH') summary.high++;
      else if (f.severity === 'MEDIUM') summary.medium++;
      else if (f.severity === 'LOW') summary.low++;
      else if (f.severity === 'INFO') summary.info++;

      totalDeductions += SEVERITY_SCORE_DEDUCTIONS[f.severity] || 0;

      if (f.owaspCategory) {
        owaspBreakdown[f.owaspCategory] = (owaspBreakdown[f.owaspCategory] || 0) + 1;
      }
    }

    // 4. Deterministic score calculation: 100 base score minus severity deductions, clamped 0-100
    const rawScore = 100 - totalDeductions;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    return {
      specId,
      timestamp: new Date().toISOString(),
      findings,
      score,
      summary,
      owaspBreakdown,
    };
  }
}

/**
 * Convenience function to execute a security audit on a CanonicalApiAst.
 */
export function runSecurityAudit(
  ast: CanonicalApiAst,
  options?: SecurityEngineOptions
): SecurityAuditResult {
  const engine = new SecurityEngine();
  return engine.runAudit(ast, options);
}
