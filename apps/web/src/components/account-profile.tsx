'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { profileUpdateSchema, type ProfileUpdateInput } from '@markaz/domain';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  StatusBadge,
} from '@markaz/ui';
import { useRouter } from '@/i18n/navigation';
import { FIELD_ERROR_KEYS } from '@/components/auth/error-keys';
import { resolveUaePassLinkError, type UaePassProfileNotice } from '@/lib/uae-pass-link';
import { trpc } from '@/trpc/react';

interface AccountProfileProps {
  fullName: string | null;
  email: string | null;
  phoneE164: string | null;
  phoneVerified: boolean;
  locale: string;
  emailVerified: boolean;
  emailPasswordLinked: boolean;
  googleLinked: boolean;
  uaePassLinked: boolean;
  uaePassSyncPending: boolean;
  uaePassStaging: boolean;
  initialNotice: UaePassProfileNotice | null;
}

export function AccountProfile({
  fullName,
  email,
  phoneE164,
  phoneVerified,
  locale,
  emailVerified,
  emailPasswordLinked,
  googleLinked,
  uaePassLinked,
  uaePassSyncPending,
  uaePassStaging,
  initialNotice,
}: AccountProfileProps) {
  const t = useTranslations('accountProfile');
  const tv = useTranslations('validation');
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [notice, setNotice] = useState<UaePassProfileNotice | null>(initialNotice);
  const [saveNotice, setSaveNotice] = useState<'success' | 'error' | null>(null);
  const [linking, setLinking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState({ fullName, phoneE164 });
  const syncStarted = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { fullName: fullName ?? '', phone: phoneE164 ?? '' },
  });

  const { mutate: syncUaePassIdentity } = trpc.profile.syncUaePassIdentity.useMutation({
    onSuccess: () => setNotice('uae_pass_linked'),
    onError: () => setNotice('uae_pass_record_error'),
  });
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: (profile) => {
      setDetails({ fullName: profile.fullName, phoneE164: profile.phoneE164 });
      reset({ fullName: profile.fullName ?? '', phone: profile.phoneE164 ?? '' });
      setEditing(false);
      setSaveNotice('success');
      // We stay on the same route; refresh updates the persistent workspace
      // setup indicator with the newly saved profile state.
      router.refresh();
    },
    onError: () => setSaveNotice('error'),
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

  function cancelEditing() {
    reset({ fullName: details.fullName ?? '', phone: details.phoneE164 ?? '' });
    setSaveNotice(null);
    setEditing(false);
  }

  const noticeContent = notice ? getNoticeContent(notice, t, uaePassLinked) : null;
  const fe = (code?: string) =>
    code ? tv(FIELD_ERROR_KEYS[code] ?? 'unexpectedError') : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-primary text-xs font-semibold uppercase tracking-[0.18em]">
            {t('eyebrow')}
          </p>
          <h1 className="font-display text-3xl tracking-tight">{t('profileTitle')}</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-6">
            {t('profileDescription')}
          </p>
        </div>
      </div>

      {noticeContent ? (
        <Alert variant={noticeContent.variant} title={noticeContent.title}>
          {noticeContent.body}
        </Alert>
      ) : null}
      {saveNotice === 'success' ? (
        <Alert variant="success" title={t('saveSuccessTitle')}>
          {t('saveSuccessBody')}
        </Alert>
      ) : null}
      {saveNotice === 'error' ? <Alert variant="destructive">{t('saveError')}</Alert> : null}

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-border/70 flex-row items-start justify-between gap-4 space-y-0 border-b">
            <div className="flex min-w-0 items-start gap-3">
              <SectionIcon>
                <UserRound className="h-5 w-5" aria-hidden />
              </SectionIcon>
              <div className="min-w-0 space-y-1">
                <CardTitle>{t('detailsTitle')}</CardTitle>
                <CardDescription>{t('detailsDescription')}</CardDescription>
              </div>
            </div>
            {!editing ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSaveNotice(null);
                  setEditing(true);
                }}
              >
                {t('editDetails')}
              </Button>
            ) : null}
          </CardHeader>

          {editing ? (
            <CardContent className="p-5 sm:p-6">
              <form
                className="space-y-5"
                noValidate
                onSubmit={handleSubmit((input) => {
                  setSaveNotice(null);
                  updateProfile.mutate(input);
                })}
              >
                <FormField
                  id="profileFullName"
                  label={t('nameLabel')}
                  error={fe(errors.fullName?.message)}
                  required
                >
                  <Input
                    id="profileFullName"
                    autoComplete="name"
                    aria-invalid={!!errors.fullName}
                    {...register('fullName')}
                  />
                </FormField>
                <FormField
                  id="profilePhone"
                  label={t('phoneLabel')}
                  error={fe(errors.phone?.message)}
                >
                  <Input
                    id="profilePhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    placeholder={t('phonePlaceholder')}
                    aria-invalid={!!errors.phone}
                    {...register('phone')}
                  />
                </FormField>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={cancelEditing}>
                    {t('cancelEdit')}
                  </Button>
                  <Button type="submit" loading={updateProfile.isPending}>
                    {updateProfile.isPending ? t('savingDetails') : t('saveDetails')}
                  </Button>
                </div>
              </form>
            </CardContent>
          ) : (
            <CardContent className="divide-border/70 divide-y p-0">
              <DetailRow label={t('nameLabel')} value={details.fullName ?? '—'} />
              <DetailRow label={t('emailLabel')} value={email ?? '—'} dir="ltr" />
              <DetailRow
                label={t('phoneLabel')}
                value={details.phoneE164 ?? t('phoneNotAdded')}
                dir={details.phoneE164 ? 'ltr' : undefined}
                status={
                  details.phoneE164 ? t(phoneVerified ? 'phoneVerified' : 'phoneSaved') : null
                }
                statusTone={phoneVerified ? 'success' : 'neutral'}
              />
            </CardContent>
          )}
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
            {emailPasswordLinked ? (
              <SignInMethod
                icon={<Mail className="h-5 w-5" aria-hidden />}
                title={t('emailMethodTitle')}
                description={email ?? t('emailMethodDescription')}
                status={emailVerified ? t('verified') : t('verificationRequired')}
                statusTone={emailVerified ? 'success' : 'warning'}
              />
            ) : null}

            {googleLinked ? (
              <SignInMethod
                icon={<UserRound className="h-5 w-5" aria-hidden />}
                title={t('googleMethodTitle')}
                description={email ?? t('googleMethodDescription')}
                status={t('linked')}
                statusTone="success"
              />
            ) : null}

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
            </div>
          </CardContent>
        </Card>
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

function DetailRow({
  label,
  value,
  dir,
  status,
  statusTone = 'neutral',
}: {
  label: string;
  value: string;
  dir?: 'ltr' | 'rtl';
  status?: string | null;
  statusTone?: 'success' | 'warning' | 'neutral';
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 px-5 py-4 sm:px-6">
      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className="break-words text-sm font-medium" dir={dir}>
          {value}
        </p>
      </div>
      {status ? <StatusBadge tone={statusTone}>{status}</StatusBadge> : null}
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
