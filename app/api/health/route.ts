import { NextResponse } from 'next/server';

import { isHostedDemo } from '@/src/lib/hostedDemo';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      hostedDemo: isHostedDemo(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
