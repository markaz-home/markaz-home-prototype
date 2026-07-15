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
import { CustomerSupportPanel } from '@/components/auth/support-panel';
import { PasswordField } from '@/components/auth/password-field';
import { ErrorSummary } from '@/components/auth/error-summary';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

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
  const tu = useTranslations('uaePass');
  const router = useRouter();
  const params = useSearchParams();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [formError, setFormError] = useState<string | null>(null);
  const [uaeLoading, setUaeLoading] = useState(false);
  const sessionExpired = params.get('notice') === 'session-expired';
  // Error redirected here by /auth/callback (provider failure or cancellation).
  const callbackError = params.get('error');
  const uaePassError =
    callbackError === 'uae_pass_cancelled'
      ? tu('cancelled')
      : callbackError === 'uae_pass'
        ? tu('error')
        : null;

  // UAE PASS Staging (POC): a REAL staging OAuth login via the Supabase custom OAuth
  // provider `custom:uae-pass`. Supabase handles the exchange + session; on return
  // /auth/callback exchanges the code. Never available in simulated mode.
  async function onUaePass() {
    setFormError(null);
    setUaeLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      // supabase-js 2.47's Provider union predates custom providers; the identifier
      // is the public `custom:<name>` slug, not a secret.
      provider: 'custom:uae-pass' as 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?locale=${locale}` },
    });
    if (error) {
      setFormError(tu('error'));
      setUaeLoading(false);
    }
    // On success the browser is redirected to UAE PASS by Supabase.
  }

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
  const errorList = (['email', 'password'] as const)
    .filter((k) => errors[k])
    .map((k) => ({ id: k, message: fe(errors[k]?.message) ?? '' }));

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
    router.replace('/dashboard');
  }

  return (
    <AuthShell support={<CustomerSupportPanel />} narrow>
      <div className="space-y-6">
        {sessionExpired ? (
          <Alert variant="warning" title={ts('expiredTitle')}>
            {ts('expiredBody')}
          </Alert>
        ) : null}
        <AuthHeading title={t('title')} description={t('description')} />
        {uaePassError ? <Alert variant="destructive">{uaePassError}</Alert> : null}
        <ErrorSummary errors={errorList} />
        {formError ? <Alert variant="destructive">{formError}</Alert> : null}

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
          <p className="text-muted-foreground text-center text-xs">{t('security')}</p>
        </form>

        {uaePassStaging ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3" aria-hidden>
              <span className="bg-border h-px flex-1" />
              <span className="text-muted-foreground text-xs uppercase">{tu('or')}</span>
              <span className="bg-border h-px flex-1" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              loading={uaeLoading}
              onClick={onUaePass}
            >
              {uaeLoading ? tu('starting') : tu('button')}
            </Button>
            <p className="text-muted-foreground text-center text-xs">{tu('testEnvNote')}</p>
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}
