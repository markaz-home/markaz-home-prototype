export const UAE_PASS_UNLINKED_HOOK_MESSAGE = 'MARKAZ_UAE_PASS_NOT_LINKED';

export const UAE_PASS_PROFILE_NOTICES = [
  'uae_pass_linked',
  'uae_pass_cancelled',
  'uae_pass_error',
  'uae_pass_identity_unavailable',
  'uae_pass_configuration_error',
  'uae_pass_record_error',
] as const;

export type UaePassProfileNotice = (typeof UAE_PASS_PROFILE_NOTICES)[number];

export function parseUaePassProfileNotice(
  value: string | string[] | undefined,
): UaePassProfileNotice | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return UAE_PASS_PROFILE_NOTICES.find((notice) => notice === candidate) ?? null;
}

/** Recognise only our exact safe Auth-hook marker; never reflect callback detail. */
export function isUnlinkedUaePassCallback(errorDescription: string | null): boolean {
  return errorDescription === UAE_PASS_UNLINKED_HOOK_MESSAGE;
}

/** Map provider-controlled callback values onto a closed set of Profile notices. */
export function resolveUaePassProfileCallbackNotice(
  providerError: string | null,
  providerErrorCode: string | null,
): UaePassProfileNotice {
  if (providerError === 'access_denied') return 'uae_pass_cancelled';
  if (providerErrorCode === 'identity_already_exists') {
    return 'uae_pass_identity_unavailable';
  }
  if (providerErrorCode === 'manual_linking_disabled') {
    return 'uae_pass_configuration_error';
  }
  return 'uae_pass_error';
}

/** Extract only Supabase's stable error code; never expose the accompanying message. */
export function resolveUaePassLinkError(error: unknown): UaePassProfileNotice {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'uae_pass_error';
  const code = typeof error.code === 'string' ? error.code : null;
  return resolveUaePassProfileCallbackNotice(null, code);
}
