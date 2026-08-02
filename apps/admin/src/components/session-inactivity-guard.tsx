'use client';

import { useEffect } from 'react';
import { startSessionInactivityGuard } from '@markaz/auth/session-inactivity';

export function SessionInactivityGuard({ redirectTo }: { redirectTo: string }) {
  useEffect(() => startSessionInactivityGuard(redirectTo), [redirectTo]);
  return null;
}
