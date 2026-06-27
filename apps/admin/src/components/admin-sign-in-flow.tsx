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

/**
 * Admin email/password sign-in (no public sign-up). On success the portal guard
 * checks account_type === 'ADMIN'; a CUSTOMER lands on the access-denied screen.
 */
export function AdminSignInFlow() {
  const t = useTranslations('auth');
  const ta = useTranslations('admin');
  const router = useRouter();
  const params = useSearchParams();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [formError, setFormError] = useState<string | null>(null);
  const passwordUpdated = params.get('reset') === '1';

  const {
    register,
    handleSubmit,
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
      setFormError(t(AUTH_ERROR_KEYS[mapAuthError(error)]));
      return;
    }
    router.replace('/overview');
    router.refresh();
  }

  return (
    <AuthCard title={ta('loginTitle')} description={ta('loginSubtitle')}>
      {passwordUpdated ? <Alert variant="success">{t('passwordUpdated')}</Alert> : null}
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
