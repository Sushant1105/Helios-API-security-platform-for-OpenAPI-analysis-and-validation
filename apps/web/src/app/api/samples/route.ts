import { NextResponse } from 'next/server';
import {
  ECOMMERCE_SAMPLE_YAML,
  ECOMMERCE_V2_SAMPLE_YAML,
  MINIMAL_SAMPLE_JSON,
} from '@helios/analysis-pipeline';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ecommerce: ECOMMERCE_SAMPLE_YAML,
    ecommerceV2: ECOMMERCE_V2_SAMPLE_YAML,
    health: MINIMAL_SAMPLE_JSON,
  });
}
