import { NextResponse } from 'next/server';
import {
  AiCopilot,
  ContextBuilder,
  MockLlmProvider,
  OllamaProvider,
  type AiAnswer,
} from '@helios/ai-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      ast,
      query,
      context = {},
    } = body;

    if (!ast) {
      return NextResponse.json(
        {
          success: false,
          error: {
            step: 'COPILOT',
            code: 'MISSING_AST',
            message: 'A valid Canonical AST is required for copilot explanations.',
          },
        },
        { status: 400 }
      );
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            step: 'COPILOT',
            code: 'MISSING_QUERY',
            message: 'Query text is required.',
          },
        },
        { status: 400 }
      );
    }

    const {
      securityFindings = [],
      validationFindings = [],
      complianceMappings = [],
      diffChanges = [],
      targetEndpointPath,
      targetHttpMethod,
      targetFindingId,
    } = context;

    // Check if local Ollama instance is available
    const liveOllama = new OllamaProvider({ timeoutMs: 15000 });
    const isOllamaUp = await liveOllama.isAvailable();

    let copilot: AiCopilot;

    if (isOllamaUp) {
      copilot = new AiCopilot({ provider: liveOllama });
    } else {
      // Build targeted deterministic context to synthesize an offline grounded explanation
      const targetedContext = ContextBuilder.buildContext(
        ast,
        {
          userQuery: query,
          targetEndpointPath,
          targetHttpMethod,
          targetFindingId,
        },
        {
          securityFindings,
          validationFindings,
          complianceMappings,
          diffChanges,
        }
      );

      // Synthesize realistic offline answer citing actual ground-truth entities
      const refEndpoints = targetedContext.targetEndpoint ? [targetedContext.targetEndpoint.id] : [];
      const refSchemas = targetedContext.targetSchema?.id ? [targetedContext.targetSchema.id] : [];
      const refFindings = targetedContext.relevantSecurityFindings.slice(0, 3).map((f) => f.id);
      const refControls = targetedContext.relevantComplianceMappings.slice(0, 3).map((c) => c.controlId);
      const refChanges = targetedContext.relevantDiffChanges.slice(0, 3).map((d) => d.id);

      let explanation = `Analytical Explanation for: "${query}"\n\n`;
      if (targetedContext.targetEndpoint) {
        explanation += `Target Endpoint: ${targetedContext.targetEndpoint.method.toUpperCase()} ${targetedContext.targetEndpoint.path}\n`;
        explanation += `Security requirements: ${targetedContext.targetEndpoint.security?.length ? 'Configured' : 'None explicitly declared'}.\n`;
      }
      if (targetedContext.relevantSecurityFindings.length > 0) {
        const topFinding = targetedContext.relevantSecurityFindings[0];
        if (topFinding) {
          explanation += `Associated Security Finding [${topFinding.ruleId}]: ${topFinding.title}.\nRemediation: ${topFinding.remediation}\n`;
        }
      }
      if (targetedContext.relevantDiffChanges.length > 0) {
        const breakingCount = targetedContext.relevantDiffChanges.filter((c) => c.compatibility === 'breaking').length;
        explanation += `Detected ${breakingCount} breaking changes in evaluated diff.\n`;
      }

      const offlineAnswer: AiAnswer = {
        answer: explanation,
        referencedEndpoints: refEndpoints,
        referencedSchemas: refSchemas,
        referencedFindings: refFindings,
        referencedControls: refControls,
        referencedChanges: refChanges,
        limitations: [
          'Static OpenAPI analysis cannot determine runtime authorization logic.',
          'Note: Synthesized via deterministic local assistant (Ollama daemon offline at localhost:11434).',
        ],
        confidence: 'HIGH',
      };

      const mockProvider = new MockLlmProvider();
      mockProvider.setDefaultResponse(offlineAnswer as unknown as Record<string, unknown>);
      copilot = new AiCopilot({ provider: mockProvider });
    }

    const verifiedResult = await copilot.ask({
      ast,
      userQuery: query,
      securityFindings,
      validationFindings,
      complianceMappings,
      diffChanges,
      targetEndpointPath,
      targetHttpMethod,
      targetFindingId,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...verifiedResult,
        isOllamaRunning: isOllamaUp,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: {
          step: 'COPILOT',
          code: 'COPILOT_EXECUTION_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 }
    );
  }
}
