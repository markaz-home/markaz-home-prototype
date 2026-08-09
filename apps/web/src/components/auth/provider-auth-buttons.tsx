'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';

const providerButtonClass =
  'relative h-12 w-full justify-center overflow-hidden px-14 text-sm sm:text-base';

export interface ProviderAuthButtonsProps {
  intent: 'sign-in' | 'sign-up';
  locale: string;
  uaePassEnabled?: boolean;
  next?: string;
  onError: (message: string) => void;
}

/**
 * UAE PASS OAuth entry point. The same provider action signs in a returning
 * identity or provisions a new CUSTOMER; the callback + onboarding guard decide
 * which destination applies after Supabase resolves the provider subject.
 */
export function ProviderAuthButtons({
  intent,
  locale,
  uaePassEnabled = false,
  next,
  onError,
}: ProviderAuthButtonsProps) {
  const t = useTranslations('providerAuth');
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [loading, setLoading] = useState(false);

  if (!uaePassEnabled) return null;

  async function start() {
    onError('');
    setLoading(true);
    const callbackParams = new URLSearchParams({ intent, locale, provider: 'uae-pass' });
    if (next && next !== '/dashboard') callbackParams.set('next', next);

    const { error } = await supabase.auth.signInWithOAuth({
      // supabase-js 2.47's Provider union predates custom-provider slugs.
      provider: 'custom:uae-pass' as never,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${callbackParams.toString()}`,
      },
    });

    if (error) {
      onError(t('error'));
      setLoading(false);
    }
    // Success redirects the browser to the selected identity provider.
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className={`${providerButtonClass} border-white/30 bg-black text-white hover:bg-white/5 hover:text-white`}
        loading={loading}
        onClick={start}
      >
        {!loading ? (
          <Image
            src="/auth-providers/uae-pass.svg"
            alt=""
            width={40}
            height={40}
            className="absolute start-1.5 h-9 w-9 shrink-0"
            aria-hidden
          />
        ) : null}
        {loading ? t('redirectingUaePass') : t('continueUaePass')}
      </Button>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs uppercase">{t('or')}</span>
        <span className="bg-border h-px flex-1" />
      </div>
    </div>
  );
}
