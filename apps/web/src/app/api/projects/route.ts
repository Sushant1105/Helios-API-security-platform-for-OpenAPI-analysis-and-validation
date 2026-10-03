import { NextResponse } from 'next/server';
import { ProjectService, sanitizeErrorMessage, PersistenceError } from '@helios/persistence';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await ProjectService.listProjects();
    return NextResponse.json({ success: true, data: projects });
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    return NextResponse.json({ success: false, error: sanitized }, { status: sanitized.statusCode });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;

    const project = await ProjectService.createProject({ name, description });
    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    const details = err instanceof PersistenceError ? err.details : undefined;
    return NextResponse.json(
      { success: false, error: { ...sanitized, details } },
      { status: sanitized.statusCode }
    );
  }
}
