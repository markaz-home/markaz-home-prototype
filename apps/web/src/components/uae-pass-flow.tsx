'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import type { IdentityVerificationStatus } from '@markaz/domain';
import { Alert, Button } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import { AuthShell, AuthHeading } from '@/components/auth/auth-shell';
import { AuthProgress } from '@/components/auth/auth-progress';
import { DemoDisclosure, DemoChip } from '@/components/auth/simulation';
import { SignOutButton } from '@/components/sign-out-button';

/** Simulated UAE PASS (design spec §16): intro → pending(controls) → success/failure. */
export function UaePassFlow({ initialStatus }: { initialStatus: IdentityVerificationStatus }) {
  const t = useTranslations('identity');
  const router = useRouter();
  const [status, setStatus] = useState<IdentityVerificationStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);

  const mutation = trpc.profile.setIdentityStatus.useMutation({
    onSuccess: (profile) => {
      setStatus(profile.identityVerificationStatus);
      if (profile.identityVerificationStatus === 'VERIFIED_DEMO') {
        router.refresh();
      }
    },
    onError: () => setError(t('failureBody')),
  });

  const go = (next: IdentityVerificationStatus) => {
    setError(null);
    mutation.mutate({ status: next });
  };
  const pending = mutation.isPending;

  return (
    <AuthShell narrow>
      <div className="space-y-6">
        <AuthProgress current={2} />
        <DemoDisclosure />
        {error ? <Alert variant="destructive">{error}</Alert> : null}

        {status === 'NOT_STARTED' ? (
          <>
            <AuthHeading title={t('introTitle')} description={t('introBody')} />
            <div className="rounded-lg border border-dashed bg-brand-100/50 p-4 text-sm">
              <p className="font-medium">In this demo, we will:</p>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground">
                <li>Start a simulated identity check</li>
                <li>Show a pending state</li>
                <li>Record a demo result</li>
              </ul>
            </div>
            <Button className="w-full" loading={pending} onClick={() => go('PENDING')}>
              {pending ? t('starting') : t('start')}
            </Button>
            <div className="text-center text-sm">
              <SignOutButton />
            </div>
          </>
        ) : null}

        {status === 'PENDING' ? (
          <>
            <div className="flex items-center justify-between">
              <AuthHeading title={t('pendingTitle')} />
              <DemoChip tone="pending">{t('pendingStatus')}</DemoChip>
            </div>
            <Alert variant="info">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('pendingBody')}
              </span>
            </Alert>
            <div className="rounded-lg border border-dashed bg-brand-100/50 p-4">
              <p className="text-sm font-medium">{t('controlsTitle')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('controlsBody')}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" loading={pending} onClick={() => go('VERIFIED_DEMO')}>
                  {t('approve')}
                </Button>
                <Button variant="outline" className="flex-1" disabled={pending} onClick={() => go('FAILED_DEMO')}>
                  {t('reject')}
                </Button>
              </div>
            </div>
            <div className="text-center text-sm">
              <SignOutButton />
            </div>
          </>
        ) : null}

        {status === 'FAILED_DEMO' ? (
          <>
            <div className="flex items-center justify-between">
              <AuthHeading title={t('failureTitle')} />
              <DemoChip tone="failed">{t('failureStatus')}</DemoChip>
            </div>
            <Alert variant="destructive">
              <span className="inline-flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" aria-hidden />
                {t('failureBody')}
              </span>
            </Alert>
            <Button className="w-full" loading={pending} onClick={() => go('PENDING')}>
              {t('retry')}
            </Button>
            <div className="text-center text-sm">
              <SignOutButton />
            </div>
          </>
        ) : null}

        {status === 'VERIFIED_DEMO' ? (
          <>
            <div className="flex items-center justify-between">
              <AuthHeading title={t('successTitle')} description={t('successBody')} />
              <DemoChip tone="verified">{t('successStatus')}</DemoChip>
            </div>
            <Alert variant="success">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                {t('successTitle')}
              </span>
            </Alert>
            <Button
              className="w-full"
              onClick={() => {
                router.replace('/dashboard');
                router.refresh();
              }}
            >
              {t('dashboard')}
            </Button>
          </>
        ) : null}
      </div>
    </AuthShell>
  );
}
