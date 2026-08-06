'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';

type Provider = 'uae-pass' | 'google';

const providerButtonClass =
  'relative h-12 w-full justify-center overflow-hidden px-14 text-sm sm:text-base';

export interface ProviderAuthButtonsProps {
  intent: 'sign-in' | 'sign-up';
  locale: string;
  googleEnabled?: boolean;
  uaePassEnabled?: boolean;
  next?: string;
  onError: (message: string) => void;
}

/**
 * Shared OAuth entry points. The same provider action signs in a returning
 * identity or provisions a new CUSTOMER; the callback + onboarding guard decide
 * which destination applies after Supabase resolves the provider subject.
 */
export function ProviderAuthButtons({
  intent,
  locale,
  googleEnabled = false,
  uaePassEnabled = false,
  next,
  onError,
}: ProviderAuthButtonsProps) {
  const t = useTranslations('providerAuth');
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [loading, setLoading] = useState<Provider | null>(null);

  if (!googleEnabled && !uaePassEnabled) return null;

  async function start(provider: Provider) {
    onError('');
    setLoading(provider);
    const callbackParams = new URLSearchParams({ intent, locale, provider });
    if (next && next !== '/dashboard') callbackParams.set('next', next);

    const { error } = await supabase.auth.signInWithOAuth({
      // supabase-js 2.47's Provider union predates custom-provider slugs.
      provider: provider === 'google' ? 'google' : ('custom:uae-pass' as 'google'),
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${callbackParams.toString()}`,
      },
    });

    if (error) {
      onError(t('error'));
      setLoading(null);
    }
    // Success redirects the browser to the selected identity provider.
  }

  return (
    <div className="space-y-3">
      {uaePassEnabled ? (
        <Button
          type="button"
          variant="outline"
          className={`${providerButtonClass} border-white/30 bg-black text-white hover:bg-white/5 hover:text-white`}
          loading={loading === 'uae-pass'}
          disabled={loading !== null && loading !== 'uae-pass'}
          onClick={() => start('uae-pass')}
        >
          {loading !== 'uae-pass' ? (
            <Image
              src="/auth-providers/uae-pass.svg"
              alt=""
              width={40}
              height={40}
              className="absolute start-1.5 h-9 w-9 shrink-0"
              aria-hidden
            />
          ) : null}
          {loading === 'uae-pass' ? t('redirectingUaePass') : t('continueUaePass')}
        </Button>
      ) : null}

      {googleEnabled ? (
        <Button
          type="button"
          variant="outline"
          className={`${providerButtonClass} border-[#8e918f] bg-[#131314] text-[#e3e3e3] hover:bg-[#1f1f20] hover:text-white`}
          loading={loading === 'google'}
          disabled={loading !== null && loading !== 'google'}
          onClick={() => start('google')}
        >
          {loading !== 'google' ? (
            <Image
              src="/auth-providers/google.svg"
              alt=""
              width={40}
              height={40}
              className="absolute start-1 h-10 w-10 shrink-0"
              aria-hidden
            />
          ) : null}
          {loading === 'google' ? t('redirectingGoogle') : t('continueGoogle')}
        </Button>
      ) : null}

      <div className="flex items-center gap-3" aria-hidden>
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs uppercase">{t('or')}</span>
        <span className="bg-border h-px flex-1" />
      </div>
    </div>
  );
}
