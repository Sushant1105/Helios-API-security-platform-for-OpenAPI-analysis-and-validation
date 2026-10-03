import { NextResponse } from 'next/server';
import { AnalysisService, sanitizeErrorMessage, PersistenceError } from '@helios/persistence';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    runId: string;
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const historicalRun = await AnalysisService.getRunById(params.runId);
    return NextResponse.json({ success: true, data: historicalRun });
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    const details = err instanceof PersistenceError ? err.details : undefined;
    return NextResponse.json(
      { success: false, error: { ...sanitized, details } },
      { status: sanitized.statusCode }
    );
  }
}
