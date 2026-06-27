'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { forgotPasswordSchema, mapAuthError, type ForgotPasswordInput } from '@markaz/domain';
import { Alert, Button, FormField, Input } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { Link, useRouter } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

export function AdminForgotPassword() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const fe = (c?: string) => (c ? t(FIELD_ERROR_KEYS[c] ?? 'errGeneric') : undefined);

  async function onSubmit(data: ForgotPasswordInput) {
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(data.email);
    if (err) {
      const key = mapAuthError(err);
      if (key === 'rate_limited' || key === 'provider_unavailable') { setError(t(AUTH_ERROR_KEYS[key])); return; }
    }
    setEmail(data.email);
    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard title={t('forgotTitle')}>
        <Alert variant="success">{t('recoverySentGeneric')}</Alert>
        <Button className="w-full" onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}>
          {t('enterRecoveryCode')}
        </Button>
        <div className="text-center text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">{t('backToSignIn')}</Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('forgotTitle')} description={t('forgotSubtitle')}>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField id="email" label={t('emailLabel')} error={fe(errors.email?.message)} required>
          <Input id="email" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder={t('emailPlaceholder')} aria-invalid={!!errors.email} {...register('email')} />
        </FormField>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          {isSubmitting ? t('sending') : t('sendRecovery')}
        </Button>
        <div className="text-center text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">{t('backToSignIn')}</Link>
        </div>
      </form>
    </AuthCard>
  );
}
