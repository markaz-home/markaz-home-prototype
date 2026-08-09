'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { signInSchema, mapAuthError, type SignInInput } from '@markaz/domain';
import { Alert, Button, FormField, Input } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { Link, useRouter } from '@/i18n/navigation';
import { AuthShell, AuthHeading } from '@/components/auth/auth-shell';
import { PasswordField } from '@/components/auth/password-field';
import { ProviderAuthButtons } from '@/components/auth/provider-auth-buttons';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';
import { resolvePostSignInDestination } from '@/lib/auth-redirect';

export function SignInForm({
  uaePassStaging = false,
  locale = 'en',
}: {
  uaePassStaging?: boolean;
  locale?: string;
}) {
  const t = useTranslations('signin');
  const tv = useTranslations('validation');
  const ta = useTranslations('auth');
  const ts = useTranslations('session');
  const tf = useTranslations('signup');
  const tp = useTranslations('providerAuth');
  const router = useRouter();
  const params = useSearchParams();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [formError, setFormError] = useState<string | null>(null);
  const sessionExpired = params.get('notice') === 'session-expired';
  // Safe marker redirected here by /auth/callback. Provider details are never reflected.
  const callbackError = params.get('error');
  const alreadyRegistered = callbackError === 'already_registered';
  const providerError =
    callbackError === 'provider_cancelled'
      ? tp('cancelled')
      : callbackError === 'provider_conflict'
        ? tp('conflict')
        : callbackError === 'provider_error'
          ? tp('error')
          : null;

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const fe = (code?: string) =>
    code ? tv(FIELD_ERROR_KEYS[code] ?? 'unexpectedError') : undefined;

  async function onSubmit(data: SignInInput) {
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      const key = mapAuthError(error);
      if (key === 'email_not_confirmed') {
        router.push(`/verify-email?email=${encodeURIComponent(getValues('email'))}`);
        return;
      }
      setFormError(key === 'invalid_credentials' ? t('incorrect') : tv(AUTH_ERROR_KEYS[key]));
      return;
    }
    router.replace(resolvePostSignInDestination(params.get('next')));
  }

  return (
    // No support panel: the card is centred on its own.
    <AuthShell narrow>
      <div className="space-y-6">
        {sessionExpired ? (
          <Alert variant="warning" title={ts('expiredTitle')}>
            {ts('expiredBody')}
          </Alert>
        ) : null}
        <AuthHeading title={t('title')} description={t('description')} />
        {alreadyRegistered ? (
          <Alert variant="warning" title={tp('alreadyRegisteredTitle')}>
            {tp('alreadyRegisteredBody')}
          </Alert>
        ) : null}
        {providerError ? <Alert variant="destructive">{providerError}</Alert> : null}
        {formError ? <Alert variant="destructive">{formError}</Alert> : null}

        <ProviderAuthButtons
          intent="sign-in"
          locale={locale}
          uaePassEnabled={uaePassStaging}
          next={resolvePostSignInDestination(params.get('next'))}
          onError={(message) => setFormError(message || null)}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <FormField id="email" label={tf('email')} error={fe(errors.email?.message)} required>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              placeholder={tf('emailPlaceholder')}
              aria-invalid={!!errors.email}
              {...register('email')}
            />
          </FormField>
          <FormField
            id="password"
            label={tf('password')}
            error={fe(errors.password?.message)}
            required
          >
            <PasswordField
              id="password"
              autoComplete="current-password"
              dir="ltr"
              placeholder={t('passwordPlaceholder')}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </FormField>
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              {t('forgot')}
            </Link>
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            {t('new')}{' '}
            <Link
              href="/sign-up"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              {ta('createAccount')}
            </Link>
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
