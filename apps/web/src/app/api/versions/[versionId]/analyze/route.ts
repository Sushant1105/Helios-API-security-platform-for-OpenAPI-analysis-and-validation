import { NextResponse } from 'next/server';
import { AnalysisService, sanitizeErrorMessage, PersistenceError } from '@helios/persistence';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    versionId: string;
  };
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const analysis = await AnalysisService.runAndPersistAnalysis(params.versionId);
    return NextResponse.json({ success: true, data: analysis });
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    const details = err instanceof PersistenceError ? err.details : undefined;
    return NextResponse.json(
      { success: false, error: { ...sanitized, details } },
      { status: sanitized.statusCode }
    );
  }
}
