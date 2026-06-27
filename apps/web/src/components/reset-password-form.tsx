'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { resetPasswordSchema, mapAuthError, type ResetPasswordInput } from '@markaz/domain';
import { Alert, Button, FormField, Input } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { Link, useRouter } from '@/i18n/navigation';
import { AuthCard, maskEmail } from '@/components/auth/auth-card';
import { PasswordField } from '@/components/auth/password-field';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password') ?? '';
  const fe = (c?: string) => (c ? t(FIELD_ERROR_KEYS[c] ?? 'errGeneric') : undefined);

  if (!email) {
    return (
      <AuthCard title={t('resetTitle')} description={t('errSessionMissing')}>
        <Button asChild className="w-full">
          <Link href="/forgot-password">{t('forgotTitle')}</Link>
        </Button>
      </AuthCard>
    );
  }

  async function onSubmit(data: ResetPasswordInput) {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError(t('errInvalidCode'));
      return;
    }
    // 1. Verify the recovery code → recovery session.
    const verify = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (verify.error) {
      setError(t(AUTH_ERROR_KEYS[mapAuthError(verify.error)]));
      return;
    }
    // 2. Update the password.
    const update = await supabase.auth.updateUser({ password: data.password });
    if (update.error) {
      setError(t(AUTH_ERROR_KEYS[mapAuthError(update.error)]));
      return;
    }
    // 3. Decision (ADR-0009): sign out and require a fresh sign-in.
    await supabase.auth.signOut();
    router.replace('/sign-in?reset=1');
    router.refresh();
  }

  return (
    <AuthCard title={t('resetTitle')} description={t('resetSubtitle', { email: maskEmail(email) })}>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField id="code" label={t('codeLabel')} required>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            dir="ltr"
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="text-center text-lg tracking-[0.4em]"
          />
        </FormField>
        <FormField id="password" label={t('newPasswordLabel')} error={fe(errors.password?.message)} required>
          <PasswordField id="password" autoComplete="new-password" dir="ltr" toggleLabel={t('showPassword')} aria-invalid={!!errors.password} {...register('password')} />
        </FormField>
        <PasswordChecklist password={password} />
        <FormField id="confirmPassword" label={t('confirmNewPasswordLabel')} error={fe(errors.confirmPassword?.message)} required>
          <PasswordField id="confirmPassword" autoComplete="new-password" dir="ltr" toggleLabel={t('showPassword')} aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
        </FormField>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          {isSubmitting ? t('updating') : t('updatePassword')}
        </Button>
      </form>
    </AuthCard>
  );
}
