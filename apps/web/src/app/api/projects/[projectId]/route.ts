import { NextResponse } from 'next/server';
import { ProjectService, sanitizeErrorMessage, PersistenceError } from '@helios/persistence';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    projectId: string;
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const project = await ProjectService.getProjectById(params.projectId);
    return NextResponse.json({ success: true, data: project });
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
    await ProjectService.deleteProject(params.projectId);
    return NextResponse.json({ success: true, message: `Project ${params.projectId} deleted.` });
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    const details = err instanceof PersistenceError ? err.details : undefined;
    return NextResponse.json(
      { success: false, error: { ...sanitized, details } },
      { status: sanitized.statusCode }
    );
  }
}
