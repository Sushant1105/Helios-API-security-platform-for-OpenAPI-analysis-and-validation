/**
 * @helios/ai-engine
 * Local AI Copilot Orchestrator.
 * Combines targeted context building, local LLM generation,
 * untrusted output parsing, and authoritative AST ground-truth validation.
 */

import type { CanonicalApiAst, CanonicalEndpoint } from '@helios/canonical-ast';
import type { ApiChange } from '@helios/diff-engine';
import type { SecurityFinding } from '@helios/security-engine';
import { ContextBuilder } from './context-builder.js';
import { parseAiResponse } from './parser.js';
import { SYSTEM_PROMPT, formatContextPrompt } from './prompts.js';
import { OllamaProvider } from './providers/ollama.js';
import type {
  AiCopilotOptions,
  AiExplanationResult,
  AiPromptPayload,
  LlmProvider,
  VerifiedAiAnswer,
} from './types.js';
import { AstGroundTruthValidator } from './verifier.js';

export class AiCopilot {
  private readonly provider: LlmProvider;
  private readonly temperature?: number;

  constructor(options: AiCopilotOptions = {}) {
    this.provider = options.provider || new OllamaProvider(options.ollamaConfig);
    this.temperature = options.temperature;
  }

  public getProvider(): LlmProvider {
    return this.provider;
  }

  public async isAvailable(): Promise<boolean> {
    return await this.provider.isAvailable();
  }

  public async ask(payload: AiPromptPayload): Promise<VerifiedAiAnswer> {
    // 1. Deterministic targeted context extraction
    const context = ContextBuilder.buildContext(
      payload.ast,
      {
        userQuery: payload.userQuery,
        targetEndpointPath: payload.targetEndpointPath,
        targetHttpMethod: payload.targetHttpMethod,
        targetFindingId: payload.targetFindingId,
      },
      {
        securityFindings: payload.securityFindings,
        validationFindings: payload.validationFindings,
        complianceMappings: payload.complianceMappings,
        diffChanges: payload.diffChanges,
      }
    );

    // 2. Format versioned prompt
    const promptText = formatContextPrompt(context);

    // 3. Dispatch to local provider
    const llmResponse = await this.provider.generate({
      prompt: promptText,
      systemPrompt: SYSTEM_PROMPT,
      temperature: this.temperature ?? 0.1,
      format: 'json',
    });

    // 4. Safely parse untrusted output
    const rawAnswer = parseAiResponse(llmResponse.text);

    // 5. Authoritatively verify against AST ground truth
    const verifiedResult = AstGroundTruthValidator.verify(rawAnswer, payload.ast, {
      securityFindings: payload.securityFindings,
      validationFindings: payload.validationFindings,
      complianceMappings: payload.complianceMappings,
      diffChanges: payload.diffChanges,
    });

    return verifiedResult;
  }

  public async explainFinding(
    finding: SecurityFinding,
    ast: CanonicalApiAst
  ): Promise<VerifiedAiAnswer> {
    return await this.ask({
      ast,
      userQuery: `Explain security finding ${finding.id} (${finding.ruleId}): ${finding.title}`,
      securityFindings: [finding],
      targetEndpointPath: finding.endpointPath,
      targetHttpMethod: finding.httpMethod,
      targetFindingId: finding.id,
    });
  }

  public async explainEndpoint(
    endpoint: CanonicalEndpoint,
    ast: CanonicalApiAst,
    findings?: SecurityFinding[]
  ): Promise<VerifiedAiAnswer> {
    return await this.ask({
      ast,
      userQuery: `Explain the endpoint ${endpoint.method.toUpperCase()} ${endpoint.path}, its security posture, and parameters.`,
      securityFindings: findings,
      targetEndpointPath: endpoint.path,
      targetHttpMethod: endpoint.method,
    });
  }

  public async explainDiff(
    diffChanges: ApiChange[],
    ast: CanonicalApiAst
  ): Promise<VerifiedAiAnswer> {
    return await this.ask({
      ast,
      userQuery: 'Summarize the breaking and security-relevant changes between the two API versions.',
      diffChanges,
    });
  }

  // Compatibility helper returning legacy AiExplanationResult
  public async queryWithLegacyResult(payload: AiPromptPayload): Promise<AiExplanationResult> {
    const verified = await this.ask(payload);
    const citations = [
      ...verified.validReferences.endpoints,
      ...verified.validReferences.findings,
      ...verified.validReferences.schemas,
      ...verified.validReferences.controls,
      ...verified.validReferences.changes,
    ];

    return {
      response: verified.verifiedAnswer,
      citations,
      validatedAgainstAst: verified.status === 'verified',
      hallucinationWarnings: verified.hallucinationsDetected.map((h) => `${h.type}: ${h.details}`),
      verifiedAnswer: verified,
    };
  }
}
