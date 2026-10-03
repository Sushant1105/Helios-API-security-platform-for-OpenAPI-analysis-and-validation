import { NextResponse } from 'next/server';
import { generateClientSdk } from '@helios/analysis-pipeline';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ast, target, packageName, packageVersion, baseUrl, clientClassName } = body;

    if (!ast) {
      return NextResponse.json(
        {
          success: false,
          error: {
            step: 'SDK',
            code: 'MISSING_AST',
            message: 'A valid Canonical AST is required for SDK generation.',
          },
        },
        { status: 400 }
      );
    }

    if (!target || (target !== 'typescript' && target !== 'python')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            step: 'SDK',
            code: 'INVALID_TARGET',
            message: 'Supported SDK targets are "typescript" and "python".',
          },
        },
        { status: 400 }
      );
    }

    const result = generateClientSdk(ast, {
      target,
      packageName: packageName || (target === 'python' ? 'helios_client' : 'helios-client'),
      packageVersion: packageVersion || '1.0.0',
      baseUrl,
      clientClassName,
    });

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
          step: 'SDK',
          code: 'INTERNAL_SDK_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 }
    );
  }
}
