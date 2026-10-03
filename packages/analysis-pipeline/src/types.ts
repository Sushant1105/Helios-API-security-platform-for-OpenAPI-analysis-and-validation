/**
 * @helios/analysis-pipeline
 * Strongly-typed domain models for the End-to-End Analysis Pipeline.
 * Orchestrates parser, Canonical AST, validator, security engine,
 * compliance engine, diff engine, SDK generator, and AI copilot.
 */

import type { CanonicalApiAst } from '@helios/canonical-ast';
import type { ComplianceReport } from '@helios/compliance-engine';
import type { DiffConfiguration } from '@helios/diff-engine';
import type { GeneratorOptions } from '@helios/sdk-generator';
import type { SecurityAuditResult, SecurityEngineOptions } from '@helios/security-engine';
import type { ParsedOpenAPISpec } from '@helios/spec-parser';
import type { ValidationOptions, ValidationResult } from '@helios/validator';
import type { AiCopilotOptions, AiPromptPayload } from '@helios/ai-engine';

export type PipelineStep =
  | 'PARSE'
  | 'AST_BUILD'
  | 'VALIDATION'
  | 'SECURITY'
  | 'COMPLIANCE'
  | 'DIFF'
  | 'SDK'
  | 'COPILOT';

export interface PipelineError {
  step: PipelineStep;
  code: string;
  message: string;
  details?: unknown;
}

export interface PipelineSummaryStats {
  endpointsCount: number;
  schemasCount: number;
  serversCount: number;
  securitySchemesCount: number;
  validationErrors: number;
  validationWarnings: number;
  securityFindingsCount: number;
  securityScore: number;
  complianceGapsCount: number;
  overallRiskScore: number;
}

export interface PipelineAnalysisResult {
  specRaw: string;
  format: 'json' | 'yaml';
  parsedSpec: ParsedOpenAPISpec;
  ast: CanonicalApiAst;
  validation: ValidationResult;
  security: SecurityAuditResult;
  compliance: ComplianceReport;
  stats: PipelineSummaryStats;
  timestamp: string;
}

export interface PipelineOptions {
  validationOptions?: ValidationOptions;
  securityOptions?: SecurityEngineOptions;
}

export interface DiffPipelineRequest {
  oldSpecContent: string;
  newSpecContent: string;
  diffConfig?: DiffConfiguration;
}

export interface SdkPipelineRequest {
  ast: CanonicalApiAst;
  options: GeneratorOptions;
}

export interface CopilotPipelineRequest {
  payload: AiPromptPayload;
  options?: AiCopilotOptions;
}
