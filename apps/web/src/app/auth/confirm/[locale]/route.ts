import type { NextRequest } from 'next/server';
import { handleRecoveryConfirmation } from '../handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  return handleRecoveryConfirmation(request, locale);
}
