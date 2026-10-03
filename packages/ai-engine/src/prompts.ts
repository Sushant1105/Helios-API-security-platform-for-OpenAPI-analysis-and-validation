/**
 * @helios/ai-engine
 * Versioned System Prompts and Prompt Formatting for HELIOS Local Copilot.
 */

import type { AiContext } from './types.js';

export const SYSTEM_PROMPT_VERSION = 'HELIOS-COPILOT-PROMPT-V1';

export const SYSTEM_PROMPT = `You are HELIOS AI Copilot, a local expert assistant for OpenAPI security, validation, compliance, and semantic API evolution.

STRICT OPERATING PRINCIPLES:
1. Grounding: Rely EXCLUSIVELY on the authoritative context provided below.
2. Anti-Hallucination: Never invent endpoints, schemas, parameters, findings, compliance controls, or diff changes that are not in the context.
3. Static Analysis Boundaries: Never claim that an OpenAPI specification proves runtime authorization correctness, encryption in transit, or operational compliance.
4. Distinguish Findings: Explicitly distinguish deterministic structural findings from heuristic indicators (e.g. sensitive keyword pattern matches).
5. Output Format: You MUST output a strictly valid JSON object matching the requested schema. No markdown wrapping outside the JSON.

JSON OUTPUT SCHEMA:
{
  "answer": "Clear, professional explanation addressing the user's question directly.",
  "referencedEndpoints": ["method:/path"],
  "referencedSchemas": ["SchemaName"],
  "referencedFindings": ["FindingID or RuleID"],
  "referencedControls": ["ControlID"],
  "referencedChanges": ["ChangeID"],
  "limitations": ["Any relevant static analysis or evidence limitations."],
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}
`;

export function formatContextPrompt(context: AiContext): string {
  const sections: string[] = [];

  sections.push(`USER QUESTION: ${context.query}`);
  sections.push(`API SUMMARY: ${context.sanitizedAstSummary.title} (v${context.sanitizedAstSummary.version}) - ${context.sanitizedAstSummary.totalEndpoints} endpoints, ${context.sanitizedAstSummary.totalSchemas} schemas`);

  if (context.targetEndpoint) {
    const ep = context.targetEndpoint;
    sections.push(`\nTARGET ENDPOINT: ${ep.method.toUpperCase()} ${ep.path}`);
    if (ep.summary) sections.push(`  Summary: ${ep.summary}`);
    if (ep.description) sections.push(`  Description: ${ep.description}`);
    if (ep.parameters && ep.parameters.length > 0) {
      sections.push(`  Parameters: ${ep.parameters.map((p) => `${p.name} (in: ${p.in}, required: ${p.required})`).join(', ')}`);
    }
    if (ep.security && ep.security.length > 0) {
      sections.push(`  Security: ${ep.security.map((s) => `${s.name}(${s.scopes.join(',')})`).join('; ')}`);
    } else {
      sections.push('  Security: None declared (Public)');
    }
  }

  if (context.targetSchema) {
    const s = context.targetSchema;
    sections.push(`\nTARGET SCHEMA: ${s.title || s.id || 'Unnamed'}`);
    sections.push(`  Type: ${Array.isArray(s.type) ? s.type.join('|') : s.type || 'object'}`);
    if (s.properties) {
      sections.push(`  Properties: ${Object.keys(s.properties).join(', ')}`);
    }
  }

  if (context.relevantSecurityFindings.length > 0) {
    sections.push('\nRELEVANT SECURITY FINDINGS:');
    for (const f of context.relevantSecurityFindings) {
      sections.push(`  - [${f.id}] (${f.severity} | ${f.confidence} confidence): ${f.title}`);
      sections.push(`    Rule: ${f.ruleId} | Category: ${f.category} ${f.owaspCategory ? `| OWASP: ${f.owaspCategory}` : ''}`);
      sections.push(`    Description: ${f.description}`);
      sections.push(`    Remediation: ${f.remediation}`);
    }
  }

  if (context.relevantValidationFindings.length > 0) {
    sections.push('\nRELEVANT VALIDATION FINDINGS:');
    for (const vf of context.relevantValidationFindings) {
      sections.push(`  - [${vf.id}] (${vf.severity}): ${vf.message}`);
      if (vf.suggestion) sections.push(`    Suggestion: ${vf.suggestion}`);
    }
  }

  if (context.relevantComplianceMappings.length > 0) {
    sections.push('\nRELEVANT COMPLIANCE MAPPINGS:');
    for (const cm of context.relevantComplianceMappings) {
      sections.push(`  - Control: ${cm.controlId} (${cm.standard}) - Status: ${cm.status}`);
      sections.push(`    Title: ${cm.title} - Description: ${cm.description}`);
    }
  }

  if (context.relevantDiffChanges.length > 0) {
    sections.push('\nRELEVANT API DIFF CHANGES:');
    for (const dc of context.relevantDiffChanges) {
      sections.push(`  - [${dc.id}] (${dc.compatibility}): ${dc.message}`);
      sections.push(`    Rationale: ${dc.rationale}`);
    }
  }

  sections.push('\nProvide your answer strictly as a JSON object.');
  return sections.join('\n');
}
