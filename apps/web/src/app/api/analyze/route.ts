import { NextResponse } from 'next/server';
import { analyzeSpecification } from '@helios/analysis-pipeline';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { specContent } = body;

    if (!specContent || typeof specContent !== 'string' || specContent.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            step: 'PARSE',
            code: 'EMPTY_SPECIFICATION',
            message: 'Specification content is required and cannot be empty.',
          },
        },
        { status: 400 }
      );
    }

    const result = await analyzeSpecification(specContent);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: {
          step: 'PARSE',
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 }
    );
  }
}
