import { NextResponse } from 'next/server';
import { compareSpecifications } from '@helios/analysis-pipeline';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { oldSpecContent, newSpecContent, config } = body;

    if (!oldSpecContent || typeof oldSpecContent !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            step: 'DIFF',
            code: 'MISSING_BASE_SPEC',
            message: 'Base (previous) specification content is required.',
          },
        },
        { status: 400 }
      );
    }

    if (!newSpecContent || typeof newSpecContent !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            step: 'DIFF',
            code: 'MISSING_TARGET_SPEC',
            message: 'Target (current) specification content is required.',
          },
        },
        { status: 400 }
      );
    }

    const result = await compareSpecifications(oldSpecContent, newSpecContent, config);

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
          step: 'DIFF',
          code: 'INTERNAL_DIFF_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 }
    );
  }
}
