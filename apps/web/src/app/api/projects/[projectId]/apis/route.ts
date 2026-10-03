import { NextResponse } from 'next/server';
import { ApiService, sanitizeErrorMessage, PersistenceError } from '@helios/persistence';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    projectId: string;
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const apis = await ApiService.listApisForProject(params.projectId);
    return NextResponse.json({ success: true, data: apis });
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
    const { name, description } = body;

    const api = await ApiService.createApi(params.projectId, { name, description });
    return NextResponse.json({ success: true, data: api }, { status: 201 });
  } catch (err: unknown) {
    const sanitized = sanitizeErrorMessage(err);
    const details = err instanceof PersistenceError ? err.details : undefined;
    return NextResponse.json(
      { success: false, error: { ...sanitized, details } },
      { status: sanitized.statusCode }
    );
  }
}
