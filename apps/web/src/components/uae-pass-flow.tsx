'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import type { IdentityVerificationStatus } from '@markaz/domain';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DemoBadge,
} from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';

export function UaePassFlow({ initialStatus }: { initialStatus: IdentityVerificationStatus }) {
  const t = useTranslations('uaePass');
  const router = useRouter();
  const [status, setStatus] = useState<IdentityVerificationStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);

  const mutation = trpc.profile.setIdentityStatus.useMutation({
    onSuccess: (profile) => {
      setStatus(profile.identityVerificationStatus);
      if (profile.identityVerificationStatus === 'VERIFIED_DEMO') {
        router.replace('/dashboard');
        router.refresh();
      }
    },
    onError: () => setError(t('failedBody')),
  });

  function go(next: IdentityVerificationStatus) {
    setError(null);
    mutation.mutate({ status: next });
  }

  const pending = mutation.isPending;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('title')}</CardTitle>
            <DemoBadge />
          </div>
          <CardDescription>{t('disclosure')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <Alert variant="destructive">{error}</Alert> : null}

          {status === 'NOT_STARTED' ? (
            <>
              <p className="text-sm text-muted-foreground">{t('notStartedBody')}</p>
              <Button className="w-full" loading={pending} onClick={() => go('PENDING')}>
                {t('start')}
              </Button>
            </>
          ) : null}

          {status === 'PENDING' ? (
            <>
              <Alert variant="info" title={t('pendingTitle')}>
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t('pendingBody')}
                </span>
              </Alert>
              <div className="flex gap-2">
                <Button className="flex-1" loading={pending} onClick={() => go('VERIFIED_DEMO')}>
                  {t('approve')}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => go('FAILED_DEMO')}
                >
                  {t('reject')}
                </Button>
              </div>
            </>
          ) : null}

          {status === 'FAILED_DEMO' ? (
            <>
              <Alert variant="destructive" title={t('failedTitle')}>
                <span className="inline-flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" aria-hidden />
                  {t('failedBody')}
                </span>
              </Alert>
              <Button className="w-full" loading={pending} onClick={() => go('PENDING')}>
                {t('tryAgain')}
              </Button>
            </>
          ) : null}

          {status === 'VERIFIED_DEMO' ? (
            <Alert variant="success" title={t('successTitle')}>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                {t('successBody')}
              </span>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
