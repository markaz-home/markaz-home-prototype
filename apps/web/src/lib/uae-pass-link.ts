export const UAE_PASS_LINK_NOTICES = [
  'uae_pass_cancelled',
  'uae_pass_error',
  'uae_pass_identity_unavailable',
  'uae_pass_configuration_error',
] as const;

export type UaePassLinkNotice = (typeof UAE_PASS_LINK_NOTICES)[number];

export function parseUaePassLinkNotice(
  value: string | string[] | undefined,
): UaePassLinkNotice | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return UAE_PASS_LINK_NOTICES.find((notice) => notice === candidate) ?? null;
}

/** Map provider-controlled callback values onto a closed set of safe UI notices. */
export function resolveUaePassCallbackNotice(
  providerError: string | null,
  providerErrorCode: string | null,
): UaePassLinkNotice {
  if (providerError === 'access_denied') return 'uae_pass_cancelled';
  if (providerErrorCode === 'identity_already_exists') return 'uae_pass_identity_unavailable';
  if (providerErrorCode === 'manual_linking_disabled') return 'uae_pass_configuration_error';
  return 'uae_pass_error';
}

/** Extract only Supabase's stable error code; never expose the accompanying message. */
export function resolveUaePassLinkError(error: unknown): UaePassLinkNotice {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'uae_pass_error';
  const code = typeof error.code === 'string' ? error.code : null;
  return resolveUaePassCallbackNotice(null, code);
}
