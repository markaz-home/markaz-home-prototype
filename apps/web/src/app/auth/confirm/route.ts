import type { NextRequest } from 'next/server';
import { handleRecoveryConfirmation } from './handler';

/**
 * Recovery/confirmation link callback. The email link points here with a
 * token_hash + type; we verify it (establishing the recovery session in secure
 * cookies) and forward to the localized reset-password screen. The destination
 * is fixed; callback input can select only a supported locale. Never displays
 * or logs the token.
 */
export async function GET(request: NextRequest) {
  return handleRecoveryConfirmation(request);
}
