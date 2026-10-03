import { analyzeSpecification, type PipelineAnalysisResult } from '@helios/analysis-pipeline';
import type { Prisma } from '@prisma/client';
import { prisma } from '../client.js';
import { PersistenceError } from '../errors.js';
import { VersionService } from './version.service.js';

export interface AnalysisRunSummary {
  id: string;
  apiVersionId: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  metrics?: {
    endpointsCount: number;
    securityFindingsCount: number;
    validationFindingsCount: number;
    riskScore: number;
  };
}

export class AnalysisService {
  static async runAndPersistAnalysis(versionId: string, apiId?: string) {
    const version = await VersionService.getVersionById(versionId, apiId);

    // Execute the existing deterministic analysis pipeline
    const pipelineResult = await analyzeSpecification(version.specification);

    if (!pipelineResult.success) {
      // Record failed run
      const failedRun = await prisma.analysisRun.create({
        data: {
          apiVersionId: versionId,
          status: 'FAILED',
          completedAt: new Date(),
          result: { error: pipelineResult.error } as unknown as Prisma.InputJsonValue,
        },
      });

      throw new PersistenceError(
        `Analysis pipeline failed at step [${pipelineResult.error.step}]: ${pipelineResult.error.message}`,
        'INVALID_SPECIFICATION',
        422,
        { runId: failedRun.id, error: pipelineResult.error }
      );
    }

    // Record successful run with complete result JSON
    const successfulRun = await prisma.analysisRun.create({
      data: {
        apiVersionId: versionId,
        status: 'SUCCESS',
        completedAt: new Date(),
        result: pipelineResult.data as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      run: {
        id: successfulRun.id,
        apiVersionId: successfulRun.apiVersionId,
        status: successfulRun.status,
        createdAt: successfulRun.createdAt,
        completedAt: successfulRun.completedAt,
      },
      data: pipelineResult.data,
    };
  }

  static async listRunsForVersion(versionId: string, apiId?: string): Promise<AnalysisRunSummary[]> {
    await VersionService.getVersionById(versionId, apiId);

    const runs = await prisma.analysisRun.findMany({
      where: { apiVersionId: versionId },
      orderBy: { createdAt: 'desc' },
    });

    return runs.map((r) => {
      let metrics: AnalysisRunSummary['metrics'] = undefined;
      try {
        if (r.status === 'SUCCESS') {
          const parsed = (
            typeof r.result === 'string' ? JSON.parse(r.result) : r.result
          ) as PipelineAnalysisResult;
          metrics = {
            endpointsCount: parsed.ast?.endpoints?.length || 0,
            securityFindingsCount: parsed.security?.findings?.length || 0,
            validationFindingsCount: parsed.validation?.findings?.length || 0,
            riskScore: parsed.compliance?.riskScore?.overallScore ?? 100,
          };
        }
      } catch {
        // Fallback if parsing fails
      }

      return {
        id: r.id,
        apiVersionId: r.apiVersionId,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        metrics,
      };
    });
  }

  static async getRunById(runId: string) {
    const run = await prisma.analysisRun.findUnique({
      where: { id: runId },
      include: {
        apiVersion: {
          include: {
            api: true,
          },
        },
      },
    });

    if (!run) {
      throw new PersistenceError(`Analysis Run with id "${runId}" was not found.`, 'RESOURCE_NOT_FOUND', 404);
    }

    let parsedResult: unknown;
    try {
      parsedResult = typeof run.result === 'string' ? JSON.parse(run.result) : run.result;
    } catch {
      parsedResult = { raw: run.result };
    }

    return {
      run: {
        id: run.id,
        apiVersionId: run.apiVersionId,
        status: run.status,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        apiVersion: run.apiVersion,
      },
      data: parsedResult as PipelineAnalysisResult,
    };
  }
}
