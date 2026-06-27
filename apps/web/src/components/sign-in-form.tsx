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
import { AuthCard } from '@/components/auth/auth-card';
import { PasswordField } from '@/components/auth/password-field';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

export function SignInForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [formError, setFormError] = useState<string | null>(null);
  const passwordUpdated = params.get('reset') === '1';
  const sessionExpired = params.get('expired') === '1';

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const fe = (code?: string) => (code ? t(FIELD_ERROR_KEYS[code] ?? 'errGeneric') : undefined);

  async function onSubmit(data: SignInInput) {
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      const key = mapAuthError(error);
      // Unverified email → route to verification rather than a dead end.
      if (key === 'email_not_confirmed') {
        router.push(`/verify-email?email=${encodeURIComponent(getValues('email'))}`);
        return;
      }
      // Generic for credentials — never reveal which field/account was wrong.
      setFormError(t(AUTH_ERROR_KEYS[key === 'invalid_credentials' ? 'invalid_credentials' : key]));
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <AuthCard
      title={t('signInTitle')}
      description={t('signInSubtitle')}
      footer={
        <span>
          {t('noAccount')}{' '}
          <Link href="/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">
            {t('createAccount')}
          </Link>
        </span>
      }
    >
      {passwordUpdated ? <Alert variant="success">{t('passwordUpdated')}</Alert> : null}
      {sessionExpired ? <Alert variant="warning">{t('sessionExpired')}</Alert> : null}
      {formError ? <Alert variant="destructive">{formError}</Alert> : null}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField id="email" label={t('emailLabel')} error={fe(errors.email?.message)} required>
          <Input id="email" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder={t('emailPlaceholder')} aria-invalid={!!errors.email} {...register('email')} />
        </FormField>
        <FormField id="password" label={t('passwordLabel')} error={fe(errors.password?.message)} required>
          <PasswordField id="password" autoComplete="current-password" dir="ltr" toggleLabel={t('showPassword')} aria-invalid={!!errors.password} {...register('password')} />
        </FormField>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t('forgotPassword')}
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          {isSubmitting ? t('signingIn') : t('signInCta')}
        </Button>
      </form>
    </AuthCard>
  );
}
