'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { forgotPasswordSchema, mapAuthError, type ForgotPasswordInput } from '@markaz/domain';
import { Alert, Button, FormField, Input } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { Link, useRouter } from '@/i18n/navigation';
import { AdminAuthShell, AdminHeading } from '@/components/auth/admin-auth-shell';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

export function AdminForgotPassword() {
  const t = useTranslations('admin');
  const tv = useTranslations('validation');
  const tf = useTranslations('signup');
  const tfo = useTranslations('forgot');
  const router = useRouter();
  const locale = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const fe = (c?: string) => (c ? tv(FIELD_ERROR_KEYS[c] ?? 'unexpectedError') : undefined);

  async function onSubmit(data: ForgotPasswordInput) {
    setError(null);
    const redirectTo = `${window.location.origin}/auth/confirm/${locale}`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(data.email, { redirectTo });
    if (err) {
      const key = mapAuthError(err);
      if (key === 'rate_limited' || key === 'provider_unavailable') {
        setError(tv(AUTH_ERROR_KEYS[key]));
        return;
      }
    }
    router.push(`/forgot-password/check-email?email=${encodeURIComponent(data.email)}`);
  }

  return (
    <AdminAuthShell>
      <div className="space-y-6">
        <AdminHeading title={t('forgotTitle')} description={t('forgotBody')} />
        {error ? <Alert variant="destructive">{error}</Alert> : null}
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
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {isSubmitting ? tfo('submitting') : tfo('submit')}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              {t('returnSignIn')}
            </Link>
          </p>
        </form>
      </div>
    </AdminAuthShell>
  );
}
