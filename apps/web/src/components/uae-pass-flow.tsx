'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, Loader2 } from 'lucide-react';
import type { IdentityVerificationStatus } from '@markaz/domain';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { Alert, Button } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import { AuthShell, AuthHeading } from '@/components/auth/auth-shell';
import { AuthProgress } from '@/components/auth/auth-progress';
import { DemoChip } from '@/components/auth/simulation';
import { SignOutButton } from '@/components/sign-out-button';
import { resolveUaePassLinkError, type UaePassLinkNotice } from '@/lib/uae-pass-link';

interface UaePassFlowProps {
  initialStatus: IdentityVerificationStatus;
  uaePassStaging?: boolean;
  providerLinked?: boolean;
  locale?: string;
  notice?: UaePassLinkNotice | null;
}

const STAGING_SYNC_ELIGIBLE = new Set<IdentityVerificationStatus>([
  'NOT_STARTED',
  'PENDING',
  'FAILED_DEMO',
]);

/**
 * Identity onboarding through a provider-linked UAE PASS Staging round trip.
 * The legacy simulation API remains available for internal testing, but it is
 * intentionally not exposed in the customer onboarding UI.
 */
export function UaePassFlow({
  initialStatus,
  uaePassStaging = false,
  providerLinked = false,
  locale = 'en',
  notice: initialNotice = null,
}: UaePassFlowProps) {
  const t = useTranslations('identity');
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [status, setStatus] = useState<IdentityVerificationStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<UaePassLinkNotice | null>(initialNotice);
  const [linkLoading, setLinkLoading] = useState(false);
  const syncStarted = useRef(false);

  const syncMutation = trpc.profile.syncUaePassIdentity.useMutation({
    onSuccess: (profile) => {
      setError(null);
      setStatus(profile.identityVerificationStatus);
    },
    onError: () => setError(t('stagingRecordError')),
  });
  const syncIdentity = syncMutation.mutate;

  useEffect(() => {
    if (!providerLinked || !STAGING_SYNC_ELIGIBLE.has(initialStatus) || syncStarted.current) {
      return;
    }
    syncStarted.current = true;
    syncIdentity();
  }, [initialStatus, providerLinked, syncIdentity]);

  async function linkUaePassIdentity() {
    setError(null);
    setNotice(null);
    setLinkLoading(true);
    const { error: linkError } = await supabase.auth.linkIdentity({
      // supabase-js 2.47's Provider union predates custom providers.
      provider: 'custom:uae-pass' as 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${new URLSearchParams({
          locale,
          next: '/onboarding/uae-pass',
        }).toString()}`,
      },
    });
    if (linkError) {
      setNotice(resolveUaePassLinkError(linkError));
      setLinkLoading(false);
    }
    // On success Supabase redirects the browser to UAE PASS Staging.
  }

  function retryIdentitySync() {
    setError(null);
    syncIdentity();
  }

  const needsReturnedIdentitySync =
    providerLinked && STAGING_SYNC_ELIGIBLE.has(status) && status !== 'VERIFIED_STAGING';
  const noticeCopy = notice
    ? {
        uae_pass_cancelled: t('stagingCancelled'),
        uae_pass_error: t('stagingFailure'),
        uae_pass_identity_unavailable: t('stagingIdentityUnavailable'),
        uae_pass_configuration_error: t('stagingConfigurationError'),
      }[notice]
    : null;
  const noticeVariant =
    notice === 'uae_pass_cancelled'
      ? 'info'
      : notice === 'uae_pass_configuration_error'
        ? 'warning'
        : 'destructive';

  return (
    <AuthShell narrow>
      <div className="space-y-6">
        <AuthProgress current={2} />
        {noticeCopy ? <Alert variant={noticeVariant}>{noticeCopy}</Alert> : null}
        {error ? <Alert variant="destructive">{error}</Alert> : null}

        {needsReturnedIdentitySync ? (
          <>
            <AuthHeading title={t('stagingReturnTitle')} description={t('stagingReturnBody')} />
            {syncMutation.isPending ? (
              <Alert variant="info">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t('stagingRecording')}
                </span>
              </Alert>
            ) : error ? (
              <div className="space-y-3">
                <Button className="w-full" onClick={retryIdentitySync}>
                  {t('stagingRetryRecord')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.replace('/dashboard')}
                >
                  {t('dashboard')}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {status !== 'VERIFIED_STAGING' ? (
              <div className="space-y-4">
                <AuthHeading title={t('introTitle')} description={t('introBody')} />
                {uaePassStaging ? (
                  <>
                    <Button className="w-full" loading={linkLoading} onClick={linkUaePassIdentity}>
                      {linkLoading ? t('stagingStarting') : t('stagingAction')}
                    </Button>
                    <p className="text-muted-foreground text-center text-xs">
                      {t('stagingEnvironmentNote')}
                    </p>
                  </>
                ) : (
                  <Alert variant="warning">{t('stagingConfigurationError')}</Alert>
                )}
                <div className="text-center text-sm">
                  <SignOutButton />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <AuthHeading
                    title={t('stagingSuccessTitle')}
                    description={t('stagingSuccessBody')}
                  />
                  <DemoChip tone="verified">{t('stagingSuccessStatus')}</DemoChip>
                </div>
                <Alert variant="success">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    {t('stagingSuccessTitle')}
                  </span>
                </Alert>
                <Button className="w-full" onClick={() => router.replace('/dashboard')}>
                  {t('dashboard')}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </AuthShell>
  );
}
