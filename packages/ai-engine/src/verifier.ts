/**
 * @helios/ai-engine
 * AST Ground-Truth Validator and Hallucination Protection.
 * Authoritatively verifies all structured model claims against the Canonical AST,
 * security findings, validator findings, compliance mappings, and diff results.
 */

import type { CanonicalApiAst } from '@helios/canonical-ast';
import type { ComplianceControlMapping } from '@helios/compliance-engine';
import type { ApiChange } from '@helios/diff-engine';
import type { SecurityFinding } from '@helios/security-engine';
import type { ValidationFinding } from '@helios/validator';
import type {
  AiAnswer,
  GroundTruthStatus,
  GroundTruthViolation,
  VerifiedAiAnswer,
} from './types.js';

export class AstGroundTruthValidator {
  public static verify(
    answer: AiAnswer,
    ast: CanonicalApiAst,
    options: {
      securityFindings?: SecurityFinding[];
      validationFindings?: ValidationFinding[];
      complianceMappings?: ComplianceControlMapping[];
      diffChanges?: ApiChange[];
    } = {}
  ): VerifiedAiAnswer {
    const violations: GroundTruthViolation[] = [];
    const validReferences = {
      endpoints: [] as string[],
      schemas: [] as string[],
      findings: [] as string[],
      controls: [] as string[],
      changes: [] as string[],
    };

    // 1. Verify Endpoints
    const existingEndpoints = new Set<string>();
    const existingPaths = new Set<string>();
    for (const ep of ast.endpoints) {
      existingEndpoints.add(`${ep.method.toLowerCase()}:${ep.path.toLowerCase()}`);
      existingEndpoints.add(`${ep.method.toUpperCase()} ${ep.path.toLowerCase()}`);
      existingEndpoints.add(ep.id.toLowerCase());
      existingPaths.add(ep.path.toLowerCase());
    }

    for (const epRef of answer.referencedEndpoints) {
      const normalized = epRef.trim().toLowerCase();
      if (
        existingEndpoints.has(normalized) ||
        existingPaths.has(normalized) ||
        ast.endpoints.some(
          (e) =>
            normalized.includes(e.path.toLowerCase()) &&
            (normalized.includes(e.method.toLowerCase()) || !normalized.includes(':'))
        )
      ) {
        validReferences.endpoints.push(epRef);
      } else {
        violations.push({
          type: 'NONEXISTENT_ENDPOINT',
          reference: epRef,
          details: `Endpoint "${epRef}" does not exist in Canonical AST.`,
        });
      }
    }

    // 2. Verify Schemas
    const existingSchemas = new Set<string>();
    for (const name of Object.keys(ast.schemas || {})) {
      existingSchemas.add(name.toLowerCase());
    }
    // Also check endpoint inline model titles
    for (const ep of ast.endpoints) {
      if (ep.requestBody?.content) {
        for (const mt of Object.values(ep.requestBody.content)) {
          if (mt.schema?.title) existingSchemas.add(mt.schema.title.toLowerCase());
          if (mt.schema?.id) existingSchemas.add(mt.schema.id.toLowerCase());
        }
      }
      for (const resp of Object.values(ep.responses || {})) {
        if (resp.content) {
          for (const mt of Object.values(resp.content)) {
            if (mt.schema?.title) existingSchemas.add(mt.schema.title.toLowerCase());
            if (mt.schema?.id) existingSchemas.add(mt.schema.id.toLowerCase());
          }
        }
      }
    }

    for (const schemaRef of answer.referencedSchemas) {
      const normalized = schemaRef.trim().toLowerCase();
      if (existingSchemas.has(normalized)) {
        validReferences.schemas.push(schemaRef);
      } else {
        violations.push({
          type: 'NONEXISTENT_SCHEMA',
          reference: schemaRef,
          details: `Schema "${schemaRef}" does not exist in Canonical AST or endpoint models.`,
        });
      }
    }

    // 3. Verify Findings
    const secFindings = options.securityFindings || [];
    const valFindings = options.validationFindings || [];

    for (const findingRef of answer.referencedFindings) {
      const normalized = findingRef.trim().toLowerCase();
      const secMatch = secFindings.find(
        (f) =>
          f.id.toLowerCase() === normalized ||
          f.ruleId.toLowerCase() === normalized ||
          normalized.includes(f.ruleId.toLowerCase())
      );
      const valMatch = valFindings.find(
        (vf) =>
          vf.id.toLowerCase() === normalized ||
          vf.code.toLowerCase() === normalized ||
          normalized.includes(vf.code.toLowerCase())
      );

      if (!secMatch && !valMatch) {
        violations.push({
          type: 'NONEXISTENT_FINDING',
          reference: findingRef,
          details: `Finding "${findingRef}" was not reported by security or validator engines.`,
        });
      } else {
        // Check finding-to-endpoint association
        if (secMatch && secMatch.endpointPath && validReferences.endpoints.length > 0) {
          const associatedWithAnyClaimedEndpoint = validReferences.endpoints.some((epStr) =>
            epStr.toLowerCase().includes(secMatch.endpointPath!.toLowerCase())
          );
          if (!associatedWithAnyClaimedEndpoint) {
            violations.push({
              type: 'UNASSOCIATED_FINDING',
              reference: findingRef,
              details: `Finding "${findingRef}" belongs to "${secMatch.endpointPath}", but was claimed for [${validReferences.endpoints.join(', ')}].`,
            });
            continue;
          }
        }
        validReferences.findings.push(findingRef);
      }
    }

    // 4. Verify Compliance Controls
    const complianceMappings = options.complianceMappings || [];
    const existingControls = new Set(complianceMappings.map((cm) => cm.controlId.toLowerCase()));

    for (const ctrlRef of answer.referencedControls) {
      const normalized = ctrlRef.trim().toLowerCase();
      if (existingControls.has(normalized)) {
        validReferences.controls.push(ctrlRef);
      } else {
        violations.push({
          type: 'NONEXISTENT_CONTROL',
          reference: ctrlRef,
          details: `Compliance control "${ctrlRef}" was not mapped or evaluated in compliance engine.`,
        });
      }
    }

    // 5. Verify Diff Changes
    const diffChanges = options.diffChanges || [];
    const existingChangeIds = new Set(diffChanges.map((c) => c.id.toLowerCase()));
    const existingChangeKinds = new Set(diffChanges.map((c) => c.kind.toLowerCase()));

    for (const changeRef of answer.referencedChanges) {
      const normalized = changeRef.trim().toLowerCase();
      if (existingChangeIds.has(normalized) || existingChangeKinds.has(normalized)) {
        validReferences.changes.push(changeRef);
      } else {
        violations.push({
          type: 'NONEXISTENT_DIFF_CHANGE',
          reference: changeRef,
          details: `API diff change "${changeRef}" does not exist in semantic diff report.`,
        });
      }
    }

    // 6. Compute Status & Remediation Notes
    const totalReferences =
      answer.referencedEndpoints.length +
      answer.referencedSchemas.length +
      answer.referencedFindings.length +
      answer.referencedControls.length +
      answer.referencedChanges.length;

    const totalValid =
      validReferences.endpoints.length +
      validReferences.schemas.length +
      validReferences.findings.length +
      validReferences.controls.length +
      validReferences.changes.length;

    let status: GroundTruthStatus;
    const remediationNotes: string[] = [];

    if (violations.length === 0) {
      status = 'verified';
    } else if (totalValid > 0) {
      status = 'partially_verified';
      remediationNotes.push(
        `Ground-truth validator flagged ${violations.length} unverified reference(s). Filtered out hallucinations.`
      );
    } else if (totalReferences > 0 && totalValid === 0) {
      status = 'rejected';
      remediationNotes.push(
        'All referenced entities in the AI response were rejected as hallucinations not found in authoritative AST ground truth.'
      );
    } else {
      status = 'verified';
    }

    // Build verified answer text
    let verifiedAnswer = answer.answer;
    if (status === 'rejected') {
      verifiedAnswer = `[HELIOS AST Ground-Truth Rejection: The AI generated claims referencing nonexistent or unassociated API elements (${violations.map((v) => v.reference).join(', ')}). Authoritative verification failed.]`;
    } else if (status === 'partially_verified') {
      verifiedAnswer = `${answer.answer}\n\n> [!WARNING]\n> **HELIOS Ground-Truth Notice:** The following claims could not be verified against the Canonical AST and were omitted from authoritative citations: ${violations.map((v) => `${v.reference} (${v.type})`).join(', ')}.`;
    }

    return {
      status,
      originalAnswer: answer,
      verifiedAnswer,
      validReferences,
      hallucinationsDetected: violations,
      remediationNotes,
      verificationTimestamp: new Date().toISOString(),
    };
  }
}
