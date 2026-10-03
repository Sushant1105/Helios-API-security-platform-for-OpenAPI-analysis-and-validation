import { NextResponse } from 'next/server';
import {
  VersionService,
  AnalysisService,
  sanitizeErrorMessage,
  PersistenceError,
} from '@helios/persistence';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    apiId: string;
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const versions = await VersionService.listVersionsForApi(params.apiId);
    return NextResponse.json({ success: true, data: versions });
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    const details = err instanceof PersistenceError ? err.details : undefined;
    return NextResponse.json(
      { success: false, error: { ...sanitized, details } },
      { status: sanitized.statusCode }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    const { version, specContent, autoAnalyze = false } = body;

    const createdVersion = await VersionService.createVersion({
      apiId: params.apiId,
      version,
      specContent,
    });

    let initialRun = null;
    let analysisResult = null;

    if (autoAnalyze) {
      try {
        const analysis = await AnalysisService.runAndPersistAnalysis(createdVersion.id, params.apiId);
        initialRun = analysis.run;
        analysisResult = analysis.data;
      } catch (analysisErr) {
        // Version was created; analysis run failed
        console.error('Initial auto-analysis failed:', analysisErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          version: createdVersion,
          run: initialRun,
          analysis: analysisResult,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    const details = err instanceof PersistenceError ? err.details : undefined;
    return NextResponse.json(
      { success: false, error: { ...sanitized, details } },
      { status: sanitized.statusCode }
    );
  }
}
