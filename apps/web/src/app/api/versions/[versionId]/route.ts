import { NextResponse } from 'next/server';
import { VersionService, sanitizeErrorMessage, PersistenceError } from '@helios/persistence';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    versionId: string;
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const version = await VersionService.getVersionById(params.versionId);
    return NextResponse.json({ success: true, data: version });
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    const details = err instanceof PersistenceError ? err.details : undefined;
    return NextResponse.json(
      { success: false, error: { ...sanitized, details } },
      { status: sanitized.statusCode }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await VersionService.deleteVersion(params.versionId);
    return NextResponse.json({ success: true, message: `Version ${params.versionId} deleted.` });
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    const details = err instanceof PersistenceError ? err.details : undefined;
    return NextResponse.json(
      { success: false, error: { ...sanitized, details } },
      { status: sanitized.statusCode }
    );
  }
}
