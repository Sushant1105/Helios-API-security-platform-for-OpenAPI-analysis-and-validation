/**
 * @helios/analysis-pipeline
 * Central Orchestration Pipeline coordinating parsing, AST generation,
 * validation, security auditing, compliance mapping, semantic diffing,
 * polyglot SDK generation, and local AI copilot grounding.
 */

import { buildCanonicalAst, type CanonicalApiAst } from '@helios/canonical-ast';
import { evaluateCompliance, type ComplianceControlMapping } from '@helios/compliance-engine';
import { diffAsts, type ApiChange, type DiffConfiguration, type DiffResult } from '@helios/diff-engine';
import { generateSdk, type GeneratedSdk, type GeneratorOptions } from '@helios/sdk-generator';
import { runSecurityAudit, type SecurityFinding } from '@helios/security-engine';
import { detectFormat, parseSpec } from '@helios/spec-parser';
import { validateAst } from '@helios/validator';
import { AiCopilot, type AiCopilotOptions, type VerifiedAiAnswer } from '@helios/ai-engine';
import { err, ok, type Result } from '@helios/shared';
import type {
  PipelineAnalysisResult,
  PipelineError,
  PipelineOptions,
  PipelineSummaryStats,
} from './types.js';

export class AnalysisPipeline {
  /**
   * Runs the complete deterministic end-to-end analysis on an OpenAPI specification text.
   */
  public async analyze(
    rawContent: string,
    options: PipelineOptions = {}
  ): Promise<Result<PipelineAnalysisResult, PipelineError>> {
    if (!rawContent || rawContent.trim().length === 0) {
      return err({
        step: 'PARSE',
        code: 'EMPTY_SPECIFICATION',
        message: 'The provided specification content is empty.',
      });
    }

    // Step 1: Ingestion & Parse
    let format: 'json' | 'yaml';
    try {
      format = detectFormat(rawContent);
    } catch {
      format = 'yaml';
    }

    const parseResult = await parseSpec(rawContent);
    if (!parseResult.success) {
      return err({
        step: 'PARSE',
        code: parseResult.error.code,
        message: parseResult.error.message,
        details: parseResult.error.details,
      });
    }

    // Step 2: Canonical AST Construction
    const astBuildResult = buildCanonicalAst(parseResult.data);
    if (!astBuildResult.success) {
      return err({
        step: 'AST_BUILD',
        code: astBuildResult.error.code,
        message: astBuildResult.error.message,
        details: astBuildResult.error.details,
      });
    }

    const ast = astBuildResult.data;

    // Step 3: Specification & AST Validation
    const validationResult = validateAst(ast, options.validationOptions);

    // Step 4: Deterministic Security Audit
    const securityResult = runSecurityAudit(ast, options.securityOptions);

    // Step 5: Compliance Mapping and Risk Score
    const complianceResult = evaluateCompliance(ast, securityResult.findings);

    // Step 6: Compute Pipeline Summary Stats
    const stats: PipelineSummaryStats = {
      endpointsCount: ast.endpoints.length,
      schemasCount: Object.keys(ast.schemas || {}).length,
      serversCount: ast.servers.length,
      securitySchemesCount: Object.keys(ast.securitySchemes || {}).length,
      validationErrors: validationResult.stats.errorCount,
      validationWarnings: validationResult.stats.warningCount,
      securityFindingsCount: securityResult.findings.length,
      securityScore: securityResult.score,
      complianceGapsCount: complianceResult.mappings.filter((m) => m.status === 'NON_COMPLIANT').length,
      overallRiskScore: complianceResult.riskScore.overallScore,
    };

    return ok({
      specRaw: rawContent,
      format,
      parsedSpec: parseResult.data,
      ast,
      validation: validationResult,
      security: securityResult,
      compliance: complianceResult,
      stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Compares two specifications via their Canonical ASTs and produces a deterministic semantic diff.
   */
  public async diff(
    oldSpecRaw: string,
    newSpecRaw: string,
    config?: DiffConfiguration
  ): Promise<Result<DiffResult, PipelineError>> {
    // Parse Old
    const oldParse = await parseSpec(oldSpecRaw);
    if (!oldParse.success) {
      return err({
        step: 'DIFF',
        code: `OLD_SPEC_${oldParse.error.code}`,
        message: `Failed to parse base specification: ${oldParse.error.message}`,
        details: oldParse.error.details,
      });
    }
    const oldAstBuild = buildCanonicalAst(oldParse.data);
    if (!oldAstBuild.success) {
      return err({
        step: 'DIFF',
        code: `OLD_SPEC_${oldAstBuild.error.code}`,
        message: `Failed to build Canonical AST for base specification: ${oldAstBuild.error.message}`,
      });
    }

    // Parse New
    const newParse = await parseSpec(newSpecRaw);
    if (!newParse.success) {
      return err({
        step: 'DIFF',
        code: `NEW_SPEC_${newParse.error.code}`,
        message: `Failed to parse target specification: ${newParse.error.message}`,
        details: newParse.error.details,
      });
    }
    const newAstBuild = buildCanonicalAst(newParse.data);
    if (!newAstBuild.success) {
      return err({
        step: 'DIFF',
        code: `NEW_SPEC_${newAstBuild.error.code}`,
        message: `Failed to build Canonical AST for target specification: ${newAstBuild.error.message}`,
      });
    }

    try {
      const diffResult = diffAsts(oldAstBuild.data, newAstBuild.data, config);
      return ok(diffResult);
    } catch (errDiff) {
      return err({
        step: 'DIFF',
        code: 'DIFF_EXECUTION_ERROR',
        message: errDiff instanceof Error ? errDiff.message : String(errDiff),
      });
    }
  }

  /**
   * Generates a typed client SDK package from a Canonical AST.
   */
  public generateSdk(
    ast: CanonicalApiAst,
    options: GeneratorOptions
  ): Result<GeneratedSdk, PipelineError> {
    try {
      const sdk = generateSdk(ast, options);
      return ok(sdk);
    } catch (errSdk) {
      return err({
        step: 'SDK',
        code: 'SDK_GENERATION_FAILED',
        message: errSdk instanceof Error ? errSdk.message : String(errSdk),
      });
    }
  }

  /**
   * Dispatches an analytical query to the local AI copilot and strictly validates the output.
   */
  public async askCopilot(
    ast: CanonicalApiAst,
    userQuery: string,
    context?: {
      securityFindings?: SecurityFinding[];
      complianceMappings?: ComplianceControlMapping[];
      diffChanges?: ApiChange[];
      targetEndpointPath?: string;
      targetHttpMethod?: string;
      targetFindingId?: string;
    },
    options?: AiCopilotOptions
  ): Promise<Result<VerifiedAiAnswer, PipelineError>> {
    try {
      const copilot = new AiCopilot(options);
      const answer = await copilot.ask({
        ast,
        userQuery,
        securityFindings: context?.securityFindings,
        complianceMappings: context?.complianceMappings,
        diffChanges: context?.diffChanges,
        targetEndpointPath: context?.targetEndpointPath,
        targetHttpMethod: context?.targetHttpMethod,
        targetFindingId: context?.targetFindingId,
      });

      return ok(answer);
    } catch (errAi) {
      return err({
        step: 'COPILOT',
        code: 'COPILOT_QUERY_FAILED',
        message: errAi instanceof Error ? errAi.message : String(errAi),
      });
    }
  }
}

// Export singleton helper methods
const defaultPipeline = new AnalysisPipeline();

export async function analyzeSpecification(
  rawContent: string,
  options?: PipelineOptions
): Promise<Result<PipelineAnalysisResult, PipelineError>> {
  return defaultPipeline.analyze(rawContent, options);
}

export async function compareSpecifications(
  oldSpecRaw: string,
  newSpecRaw: string,
  config?: DiffConfiguration
): Promise<Result<DiffResult, PipelineError>> {
  return defaultPipeline.diff(oldSpecRaw, newSpecRaw, config);
}

export function generateClientSdk(
  ast: CanonicalApiAst,
  options: GeneratorOptions
): Result<GeneratedSdk, PipelineError> {
  return defaultPipeline.generateSdk(ast, options);
}

export async function queryCopilot(
  ast: CanonicalApiAst,
  userQuery: string,
  context?: {
    securityFindings?: SecurityFinding[];
    complianceMappings?: ComplianceControlMapping[];
    diffChanges?: ApiChange[];
    targetEndpointPath?: string;
    targetHttpMethod?: string;
    targetFindingId?: string;
  },
  options?: AiCopilotOptions
): Promise<Result<VerifiedAiAnswer, PipelineError>> {
  return defaultPipeline.askCopilot(ast, userQuery, context, options);
}
