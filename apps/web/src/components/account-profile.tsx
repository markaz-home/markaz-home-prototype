'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusBadge,
} from '@markaz/ui';
import { resolveUaePassLinkError, type UaePassProfileNotice } from '@/lib/uae-pass-link';
import { trpc } from '@/trpc/react';

interface AccountProfileProps {
  fullName: string | null;
  email: string | null;
  locale: string;
  emailVerified: boolean;
  uaePassLinked: boolean;
  uaePassSyncPending: boolean;
  uaePassStaging: boolean;
  initialNotice: UaePassProfileNotice | null;
}

export function AccountProfile({
  fullName,
  email,
  locale,
  emailVerified,
  uaePassLinked,
  uaePassSyncPending,
  uaePassStaging,
  initialNotice,
}: AccountProfileProps) {
  const t = useTranslations('accountProfile');
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [notice, setNotice] = useState<UaePassProfileNotice | null>(initialNotice);
  const [linking, setLinking] = useState(false);
  const syncStarted = useRef(false);
  const { mutate: syncUaePassIdentity } = trpc.profile.syncUaePassIdentity.useMutation({
    onSuccess: () => setNotice('uae_pass_linked'),
    onError: () => setNotice('uae_pass_record_error'),
  });

  useEffect(() => {
    if (!uaePassSyncPending || syncStarted.current) return;
    syncStarted.current = true;
    syncUaePassIdentity();
  }, [syncUaePassIdentity, uaePassSyncPending]);

  async function linkUaePass() {
    setNotice(null);
    setLinking(true);
    const { error } = await supabase.auth.linkIdentity({
      // supabase-js 2.47's Provider union predates custom providers.
      provider: 'custom:uae-pass' as 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${new URLSearchParams({
          locale,
          flow: 'link',
        }).toString()}`,
      },
    });
    if (error) {
      setNotice(resolveUaePassLinkError(error));
      setLinking(false);
    }
    // On success Supabase redirects the browser to UAE PASS Staging.
  }

  const noticeContent = notice ? getNoticeContent(notice, t, uaePassLinked) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2">
        <p className="text-primary text-xs font-semibold uppercase tracking-[0.18em]">
          {t('eyebrow')}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('profileTitle')}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-6">
          {t('profileDescription')}
        </p>
      </div>

      {noticeContent ? (
        <Alert variant={noticeContent.variant} title={noticeContent.title}>
          {noticeContent.body}
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-border/70 border-b">
            <div className="flex items-start gap-3">
              <SectionIcon>
                <UserRound className="h-5 w-5" aria-hidden />
              </SectionIcon>
              <div className="min-w-0 space-y-1">
                <CardTitle>{t('detailsTitle')}</CardTitle>
                <CardDescription>{t('detailsDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-border/70 divide-y p-0">
            <DetailRow label={t('nameLabel')} value={fullName ?? '—'} />
            <DetailRow label={t('emailLabel')} value={email ?? '—'} dir="ltr" />
            <DetailRow label={t('accountTypeLabel')} value={t('accountTypeCustomer')} />
          </CardContent>
        </Card>

        <Card id="sign-in-methods" className="min-w-0 scroll-mt-20 overflow-hidden">
          <CardHeader className="border-border/70 border-b">
            <div className="flex items-start gap-3">
              <SectionIcon>
                <KeyRound className="h-5 w-5" aria-hidden />
              </SectionIcon>
              <div className="min-w-0 space-y-1">
                <CardTitle>{t('methodsTitle')}</CardTitle>
                <CardDescription>{t('methodsDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-border/70 divide-y p-0">
            <SignInMethod
              icon={<Mail className="h-5 w-5" aria-hidden />}
              title={t('emailMethodTitle')}
              description={email ?? t('emailMethodDescription')}
              status={emailVerified ? t('verified') : t('verificationRequired')}
              statusTone={emailVerified ? 'success' : 'warning'}
            />

            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="border-primary/30 bg-primary/10 text-primary grid h-10 w-10 shrink-0 place-items-center rounded-lg border">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{t('uaePassMethodTitle')}</h3>
                    <StatusBadge tone={uaePassLinked ? 'success' : 'neutral'}>
                      {uaePassLinked ? t('linked') : t('notLinked')}
                    </StatusBadge>
                  </div>
                  <p className="text-muted-foreground text-sm leading-6">
                    {uaePassLinked ? t('uaePassLinkedDescription') : t('uaePassMethodDescription')}
                  </p>
                </div>
              </div>

              {!uaePassLinked ? (
                uaePassStaging ? (
                  <Button type="button" loading={linking} onClick={linkUaePass}>
                    {linking ? t('linkingUaePass') : t('linkUaePass')}
                  </Button>
                ) : (
                  <p className="text-muted-foreground text-sm">{t('uaePassUnavailable')}</p>
                )
              ) : null}

              <p className="text-muted-foreground text-xs leading-5">
                {t('stagingEnvironmentNote')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border-border/70 bg-card/40 flex gap-3 rounded-lg border p-4">
        <ShieldCheck className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('securityTitle')}</p>
          <p className="text-muted-foreground text-sm leading-6">{t('securityDescription')}</p>
        </div>
      </div>
    </div>
  );
}

function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-primary/30 bg-primary/10 text-primary grid h-10 w-10 shrink-0 place-items-center rounded-lg border">
      {children}
    </span>
  );
}

function DetailRow({ label, value, dir }: { label: string; value: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className="space-y-1 px-5 py-4 sm:px-6">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
      <p
        className={
          dir === 'ltr' ? 'break-all text-sm font-medium' : 'break-words text-sm font-medium'
        }
        dir={dir}
      >
        {value}
      </p>
    </div>
  );
}

function SignInMethod({
  icon,
  title,
  description,
  status,
  statusTone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: string;
  statusTone: 'success' | 'warning';
}) {
  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:p-6">
      <div className="border-border bg-foreground/[0.03] text-muted-foreground grid h-10 w-10 shrink-0 place-items-center rounded-lg border">
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <StatusBadge tone={statusTone}>{status}</StatusBadge>
        </div>
        <p className="text-muted-foreground break-all text-sm leading-6" dir="ltr">
          {description}
        </p>
      </div>
    </div>
  );
}

type Translation = ReturnType<typeof useTranslations<'accountProfile'>>;

function getNoticeContent(notice: UaePassProfileNotice, t: Translation, uaePassLinked: boolean) {
  if (notice === 'uae_pass_linked') {
    return {
      variant: 'success' as const,
      title: t('linkSuccessTitle'),
      body: t('linkSuccessBody'),
    };
  }
  if (notice === 'uae_pass_cancelled') {
    return {
      variant: 'info' as const,
      title: t('linkCancelledTitle'),
      body: t('linkCancelledBody'),
    };
  }
  if (notice === 'uae_pass_identity_unavailable') {
    return {
      variant: 'destructive' as const,
      title: t('identityUnavailableTitle'),
      body: t('identityUnavailableBody'),
    };
  }
  if (notice === 'uae_pass_configuration_error') {
    return {
      variant: 'warning' as const,
      title: t('configurationErrorTitle'),
      body: t('configurationErrorBody'),
    };
  }
  if (notice === 'uae_pass_record_error' && uaePassLinked) {
    return {
      variant: 'warning' as const,
      title: t('linkRecordedPendingTitle'),
      body: t('linkRecordedPendingBody'),
    };
  }
  return {
    variant: 'destructive' as const,
    title: t('linkErrorTitle'),
    body: t('linkErrorBody'),
  };
}
