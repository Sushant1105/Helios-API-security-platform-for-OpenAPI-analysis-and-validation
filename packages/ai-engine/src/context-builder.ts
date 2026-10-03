/**
 * @helios/ai-engine
 * Deterministic AI Context Builder and Secret Sanitizer.
 * Extracts focused subsets of the AST, findings, compliance, and diffs without whole-spec dumping.
 */

import type { CanonicalApiAst, CanonicalEndpoint, CanonicalSchema } from '@helios/canonical-ast';
import type { ComplianceControlMapping } from '@helios/compliance-engine';
import type { ApiChange } from '@helios/diff-engine';
import type { SecurityFinding } from '@helios/security-engine';
import type { ValidationFinding } from '@helios/validator';
import type { AiContext, ContextQuery } from './types.js';

const SENSITIVE_KEYWORD_PATTERNS = [
  /password/i,
  /secret/i,
  /apikey/i,
  /api_key/i,
  /token/i,
  /bearer/i,
  /authorization/i,
  /private_?key/i,
  /ssn/i,
  /credit_?card/i,
];

function isSensitiveFieldName(name: string): boolean {
  return SENSITIVE_KEYWORD_PATTERNS.some((pattern) => pattern.test(name));
}

export function sanitizeObjectData<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectData(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (isSensitiveFieldName(key) && typeof val === 'string') {
      result[key] = '[REDACTED_FOR_PRIVACY]';
    } else if (typeof val === 'object' && val !== null) {
      result[key] = sanitizeObjectData(val);
    } else {
      result[key] = val;
    }
  }
  return result as T;
}

export class ContextBuilder {
  public static buildContext(
    ast: CanonicalApiAst,
    query: ContextQuery,
    options: {
      securityFindings?: SecurityFinding[];
      validationFindings?: ValidationFinding[];
      complianceMappings?: ComplianceControlMapping[];
      diffChanges?: ApiChange[];
    } = {}
  ): AiContext {
    const contextSources: string[] = ['ast_metadata'];
    const lowerQuery = query.userQuery.toLowerCase();

    // 1. Identify Target Endpoint
    let targetEndpoint: CanonicalEndpoint | undefined;
    if (query.targetEndpointPath) {
      const matchMethod = (query.targetHttpMethod || '').toLowerCase();
      targetEndpoint = ast.endpoints.find((ep) => {
        const pathMatches = ep.path.toLowerCase() === query.targetEndpointPath!.toLowerCase();
        return matchMethod ? pathMatches && ep.method === matchMethod : pathMatches;
      });
    }

    // Auto-detect endpoint from query if not explicitly supplied
    if (!targetEndpoint) {
      for (const ep of ast.endpoints) {
        if (lowerQuery.includes(ep.path.toLowerCase())) {
          if (lowerQuery.includes(ep.method.toLowerCase()) || !targetEndpoint) {
            targetEndpoint = ep;
            if (lowerQuery.includes(ep.method.toLowerCase())) break;
          }
        }
      }
    }

    if (targetEndpoint) {
      contextSources.push(`endpoint:${targetEndpoint.method.toUpperCase()} ${targetEndpoint.path}`);
    }

    // 2. Identify Target Schema
    let targetSchema: CanonicalSchema | undefined;
    if (query.targetSchemaName && ast.schemas[query.targetSchemaName]) {
      targetSchema = ast.schemas[query.targetSchemaName];
      contextSources.push(`schema:${query.targetSchemaName}`);
    } else {
      for (const [name, schema] of Object.entries(ast.schemas || {})) {
        if (lowerQuery.includes(name.toLowerCase())) {
          targetSchema = schema;
          contextSources.push(`schema:${name}`);
          break;
        }
      }
    }

    // 3. Relevant Security Findings
    let relevantSecurityFindings: SecurityFinding[] = [];
    const allSec = options.securityFindings || [];

    if (query.targetFindingId) {
      relevantSecurityFindings = allSec.filter(
        (f) =>
          f.id.toLowerCase() === query.targetFindingId!.toLowerCase() ||
          f.ruleId.toLowerCase() === query.targetFindingId!.toLowerCase()
      );
    } else if (targetEndpoint) {
      relevantSecurityFindings = allSec.filter(
        (f) =>
          f.endpointPath?.toLowerCase() === targetEndpoint!.path.toLowerCase() &&
          (!f.httpMethod || f.httpMethod.toLowerCase() === targetEndpoint!.method.toLowerCase())
      );
    } else {
      // Check query for rule IDs or include critical/high findings
      const matchedByRule = allSec.filter((f) => lowerQuery.includes(f.ruleId.toLowerCase()));
      if (matchedByRule.length > 0) {
        relevantSecurityFindings = matchedByRule;
      } else {
        relevantSecurityFindings = allSec
          .filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
          .slice(0, 5);
      }
    }

    if (relevantSecurityFindings.length > 0) {
      contextSources.push(`security_findings(${relevantSecurityFindings.length})`);
    }

    // 4. Relevant Validation Findings
    let relevantValidationFindings: ValidationFinding[] = [];
    const allVal = options.validationFindings || [];
    if (targetEndpoint) {
      relevantValidationFindings = allVal.filter(
        (vf) =>
          (vf.path && vf.path.includes(targetEndpoint!.path)) ||
          (vf.endpointId && vf.endpointId.includes(targetEndpoint!.path))
      );
    } else {
      relevantValidationFindings = allVal.filter(
        (vf) => lowerQuery.includes(vf.code.toLowerCase()) || vf.severity === 'error'
      ).slice(0, 5);
    }

    if (relevantValidationFindings.length > 0) {
      contextSources.push(`validation_findings(${relevantValidationFindings.length})`);
    }

    // 5. Relevant Compliance Mappings
    let relevantComplianceMappings: ComplianceControlMapping[] = [];
    const allComp = options.complianceMappings || [];
    if (query.targetControlId) {
      relevantComplianceMappings = allComp.filter(
        (cm) => cm.controlId.toLowerCase() === query.targetControlId!.toLowerCase()
      );
    } else {
      for (const cm of allComp) {
        if (lowerQuery.includes(cm.controlId.toLowerCase())) {
          relevantComplianceMappings.push(cm);
        }
      }
    }

    if (relevantComplianceMappings.length > 0) {
      contextSources.push(`compliance_mappings(${relevantComplianceMappings.length})`);
    }

    // 6. Relevant Diff Changes
    let relevantDiffChanges: ApiChange[] = [];
    const allDiff = options.diffChanges || [];
    if (query.targetChangeId) {
      relevantDiffChanges = allDiff.filter((c) => c.id === query.targetChangeId);
    } else if (targetEndpoint) {
      relevantDiffChanges = allDiff.filter(
        (c) => c.path && c.path.toLowerCase() === targetEndpoint!.path.toLowerCase()
      );
    } else if (lowerQuery.includes('breaking') || lowerQuery.includes('change') || lowerQuery.includes('diff')) {
      relevantDiffChanges = allDiff
        .filter((c) => c.compatibility === 'breaking' || c.isSecurityRelevant)
        .slice(0, 10);
    }

    if (relevantDiffChanges.length > 0) {
      contextSources.push(`diff_changes(${relevantDiffChanges.length})`);
    }

    // 7. Sanitized Summary
    const sanitizedAstSummary = {
      title: ast.title || 'Untitled API',
      version: ast.version || '1.0.0',
      totalEndpoints: ast.endpoints.length,
      totalSchemas: Object.keys(ast.schemas || {}).length,
    };

    return {
      query: query.userQuery,
      targetEndpoint: sanitizeObjectData(targetEndpoint),
      targetSchema: sanitizeObjectData(targetSchema),
      relevantSecurityFindings: sanitizeObjectData(relevantSecurityFindings),
      relevantValidationFindings: sanitizeObjectData(relevantValidationFindings),
      relevantComplianceMappings: sanitizeObjectData(relevantComplianceMappings),
      relevantDiffChanges: sanitizeObjectData(relevantDiffChanges),
      sanitizedAstSummary,
      contextSources,
    };
  }
}
