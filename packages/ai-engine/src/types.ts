/**
 * @helios/ai-engine
 * Strongly-typed domain models for Local AI Copilot,
 * LLM Provider Abstraction, Context Extraction, and AST Ground-Truth Verification.
 */

import type { CanonicalApiAst, CanonicalEndpoint, CanonicalSchema } from '@helios/canonical-ast';
import type { ComplianceControlMapping } from '@helios/compliance-engine';
import type { ApiChange } from '@helios/diff-engine';
import type { SecurityFinding } from '@helios/security-engine';
import type { ValidationFinding } from '@helios/validator';

export type AiConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface LlmRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  format?: 'json';
  signal?: AbortSignal;
}

export interface LlmResponse {
  text: string;
  model: string;
  totalDurationMs?: number;
  promptEvalCount?: number;
  evalCount?: number;
}

export interface LlmProvider {
  readonly name: string;
  generate(request: LlmRequest): Promise<LlmResponse>;
  isAvailable(): Promise<boolean>;
}

export interface OllamaProviderConfig {
  baseUrl?: string; // Default: 'http://localhost:11434'
  modelName?: string; // Default: 'llama3'
  timeoutMs?: number; // Default: 30000
  temperature?: number; // Default: 0.1
  fetch?: typeof fetch;
}

export interface ContextQuery {
  userQuery: string;
  targetEndpointPath?: string;
  targetHttpMethod?: string;
  targetFindingId?: string;
  targetSchemaName?: string;
  targetControlId?: string;
  targetChangeId?: string;
}

export interface AiContext {
  query: string;
  targetEndpoint?: CanonicalEndpoint;
  targetSchema?: CanonicalSchema;
  relevantSecurityFindings: SecurityFinding[];
  relevantValidationFindings: ValidationFinding[];
  relevantComplianceMappings: ComplianceControlMapping[];
  relevantDiffChanges: ApiChange[];
  sanitizedAstSummary: {
    title: string;
    version: string;
    totalEndpoints: number;
    totalSchemas: number;
  };
  contextSources: string[];
}

export interface AiAnswer {
  answer: string;
  referencedEndpoints: string[]; // e.g. ["get:/users/{id}"]
  referencedSchemas: string[]; // e.g. ["User"]
  referencedFindings: string[]; // e.g. ["AUTH-001:get:/users/{id}"]
  referencedControls: string[]; // e.g. ["PCI-4.2.1"]
  referencedChanges: string[]; // e.g. ["endpoint:delete:/products/{id}:ENDPOINT_REMOVED"]
  limitations: string[];
  confidence: AiConfidence;
}

export type GroundTruthStatus = 'verified' | 'partially_verified' | 'rejected';

export type GroundTruthViolationType =
  | 'NONEXISTENT_ENDPOINT'
  | 'NONEXISTENT_SCHEMA'
  | 'NONEXISTENT_FINDING'
  | 'UNASSOCIATED_FINDING'
  | 'NONEXISTENT_CONTROL'
  | 'NONEXISTENT_DIFF_CHANGE'
  | 'UNSUPPORTED_CLAIM';

export interface GroundTruthViolation {
  type: GroundTruthViolationType;
  reference: string;
  details: string;
}

export interface VerifiedAiAnswer {
  status: GroundTruthStatus;
  originalAnswer: AiAnswer;
  verifiedAnswer: string;
  validReferences: {
    endpoints: string[];
    schemas: string[];
    findings: string[];
    controls: string[];
    changes: string[];
  };
  hallucinationsDetected: GroundTruthViolation[];
  remediationNotes: string[];
  verificationTimestamp: string;
}

export interface AiCopilotOptions {
  provider?: LlmProvider;
  ollamaConfig?: OllamaProviderConfig;
  temperature?: number;
}

// Backward compatibility interfaces
export interface AiEngineConfig {
  provider: 'ollama' | 'mock' | 'disabled';
  baseUrl?: string;
  modelName?: string;
  temperature?: number;
}

export interface RagContextChunk {
  id: string;
  source: string;
  title: string;
  content: string;
  score?: number;
}

export interface AiPromptPayload {
  ast: CanonicalApiAst;
  userQuery: string;
  securityFindings?: SecurityFinding[];
  validationFindings?: ValidationFinding[];
  complianceMappings?: ComplianceControlMapping[];
  diffChanges?: ApiChange[];
  targetEndpointPath?: string;
  targetHttpMethod?: string;
  targetFindingId?: string;
}

export interface AiExplanationResult {
  response: string;
  citations: string[];
  validatedAgainstAst: boolean;
  hallucinationWarnings?: string[];
  verifiedAnswer?: VerifiedAiAnswer;
}
