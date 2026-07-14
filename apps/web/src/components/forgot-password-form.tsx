'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { forgotPasswordSchema, mapAuthError, type ForgotPasswordInput } from '@markaz/domain';
import { Alert, Button, FormField, Input } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { Link, useRouter } from '@/i18n/navigation';
import { AuthShell, AuthHeading } from '@/components/auth/auth-shell';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

export function ForgotPasswordForm() {
  const t = useTranslations('forgot');
  const tv = useTranslations('validation');
  const tf = useTranslations('signup');
  const router = useRouter();
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

  const fe = (code?: string) =>
    code ? tv(FIELD_ERROR_KEYS[code] ?? 'unexpectedError') : undefined;

  async function onSubmit(data: ForgotPasswordInput) {
    setError(null);
    const redirectTo = `${window.location.origin}/auth/confirm`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(data.email, { redirectTo });
    // Only surface rate/provider failures — never reveal account existence.
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
    <AuthShell narrow>
      <div className="space-y-6">
        <AuthHeading title={t('title')} description={t('description')} />
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
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
          <p className="text-muted-foreground text-center text-xs">{t('security')}</p>
          <p className="text-center text-sm">
            <Link href="/sign-in" className="text-muted-foreground hover:text-foreground">
              {t('return')}
            </Link>
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
