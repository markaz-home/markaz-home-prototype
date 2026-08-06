'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { profileSetupSchema, type ProfileSetupInput } from '@markaz/domain';
import { Alert, Button, FormField, Input, StatusBadge } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import { AuthShell, AuthHeading } from '@/components/auth/auth-shell';
import { AuthProgress, type StepStatus } from '@/components/auth/auth-progress';
import { FIELD_ERROR_KEYS } from '@/components/auth/error-keys';

export function ProfileSetupForm({
  email,
  emailVerified = false,
  initialName = '',
  initialPhone,
  provider,
}: {
  email?: string | null;
  emailVerified?: boolean;
  initialName?: string | null;
  initialPhone?: string | null;
  provider?: 'uae-pass' | 'google' | null;
}) {
  const t = useTranslations('profile');
  const tv = useTranslations('validation');
  const ts = useTranslations('signup');
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileSetupInput>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      fullName: initialName ?? '',
      acceptTerms: false as never,
      acceptPrivacy: false as never,
    },
  });

  const mutation = trpc.profile.completeSetup.useMutation({
    onSuccess: () => {
      router.replace('/dashboard');
    },
    onError: () => setSaveError(tv('unexpectedError')),
  });

  const fe = (c?: string) => (c ? tv(FIELD_ERROR_KEYS[c] ?? 'unexpectedError') : undefined);
  const providerName = provider
    ? t(provider === 'uae-pass' ? 'uaePassProvider' : 'googleProvider')
    : null;
  const hasProviderName = !!provider && !!initialName?.trim();
  const providerReview = !!provider && hasProviderName;
  // Setup-status resume variant (spec §9.7): account details needs attention.
  const statuses: StepStatus[] = ['action', 'complete'];

  return (
    <AuthShell narrow>
      <div className="space-y-6">
        <AuthHeading
          title={
            providerReview ? t('providerReviewTitle') : provider ? t('providerMissingTitle') : t('title')
          }
          description={
            providerReview
              ? t('providerReviewDescription', { provider: providerName })
              : provider
                ? t('providerMissingDescription', { provider: providerName })
                : t('descriptionOne')
          }
          progress={<AuthProgress current={0} statuses={statuses} />}
        />
        {saveError ? <Alert variant="destructive">{saveError}</Alert> : null}

        {provider ? (
          <div className="bg-muted/30 overflow-hidden rounded-md border">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <p className="text-sm font-semibold">{t('detailsFrom', { provider: providerName })}</p>
              <StatusBadge tone="success">{t('provided')}</StatusBadge>
            </div>
            <dl className="divide-y">
              {hasProviderName ? (
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr] sm:items-center">
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {ts('fullName')}
                  </dt>
                  <dd className="text-sm font-medium">{initialName}</dd>
                </div>
              ) : null}
              {email ? (
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr] sm:items-center">
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {t('email')}
                  </dt>
                  <dd className="text-sm font-medium" dir="ltr">
                    {email}
                  </dd>
                </div>
              ) : null}
              {initialPhone ? (
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr] sm:items-center">
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {t('mobileNumber')}
                  </dt>
                  <dd className="text-sm font-medium" dir="ltr">
                    {initialPhone}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : email ? (
          <div className="bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground" dir="ltr">
              {email}
            </span>
            <StatusBadge tone={emailVerified ? 'success' : 'neutral'}>
              {emailVerified ? t('verifiedEmail') : t('emailProvided')}
            </StatusBadge>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit((d) => {
            setSaveError(null);
            mutation.mutate(d);
          })}
          className="space-y-5"
          noValidate
        >
          {hasProviderName ? (
            <input type="hidden" {...register('fullName')} />
          ) : (
            <FormField
              id="fullName"
              label={ts('fullName')}
              error={fe(errors.fullName?.message)}
              required
            >
              <Input
                id="fullName"
                autoComplete="name"
                placeholder={ts('fullNamePlaceholder')}
                aria-invalid={!!errors.fullName}
                {...register('fullName')}
              />
            </FormField>
          )}

          <label className="flex items-start gap-3 text-sm">
            <input
              id="acceptTerms"
              type="checkbox"
              className="accent-primary focus-visible:ring-ring mt-1 h-4 w-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              {...register('acceptTerms')}
            />
            <span>{ts('terms')}</span>
          </label>
          {errors.acceptTerms ? (
            <p role="alert" className="text-destructive text-xs font-medium">
              {fe(errors.acceptTerms.message)}
            </p>
          ) : null}
          <label className="flex items-start gap-3 text-sm">
            <input
              id="acceptPrivacy"
              type="checkbox"
              className="accent-primary focus-visible:ring-ring mt-1 h-4 w-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              {...register('acceptPrivacy')}
            />
            <span>{ts('privacy')}</span>
          </label>
          {errors.acceptPrivacy ? (
            <p role="alert" className="text-destructive text-xs font-medium">
              {fe(errors.acceptPrivacy.message)}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={mutation.isPending}>
            {mutation.isPending
              ? t(provider ? 'providerSubmitting' : 'submitting')
              : t(provider ? 'providerSubmit' : 'submit')}
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            {t(provider ? 'providerReassurance' : 'reassurance')}
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
