import { NextResponse } from 'next/server';
import { DiffService, sanitizeErrorMessage, PersistenceError } from '@helios/persistence';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { baseVersionId, targetVersionId, config } = body;

    if (!baseVersionId || typeof baseVersionId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'baseVersionId is required.',
            statusCode: 400,
          },
        },
        { status: 400 }
      );
    }

    if (!targetVersionId || typeof targetVersionId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'targetVersionId is required.',
            statusCode: 400,
          },
        },
        { status: 400 }
      );
    }

    const comparison = await DiffService.compareSavedVersions(baseVersionId, targetVersionId, config);
    return NextResponse.json({ success: true, data: comparison });
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    const details = err instanceof PersistenceError ? err.details : undefined;
    return NextResponse.json(
      { success: false, error: { ...sanitized, details } },
      { status: sanitized.statusCode }
    );
  }
}
