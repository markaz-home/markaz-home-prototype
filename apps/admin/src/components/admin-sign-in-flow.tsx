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
import { AdminAuthShell, AdminHeading } from '@/components/auth/admin-auth-shell';
import { PasswordField } from '@/components/auth/password-field';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

export function AdminSignInFlow() {
  const t = useTranslations('admin');
  const ts = useTranslations('signin');
  const tv = useTranslations('validation');
  const tf = useTranslations('signup');
  const router = useRouter();
  const params = useSearchParams();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [formError, setFormError] = useState<string | null>(null);
  const expired = params.get('notice') === 'session-expired';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  const fe = (c?: string) => (c ? tv(FIELD_ERROR_KEYS[c] ?? 'unexpectedError') : undefined);

  async function onSubmit(data: SignInInput) {
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
    if (error) {
      const key = mapAuthError(error);
      setFormError(key === 'invalid_credentials' ? ts('incorrect') : tv(AUTH_ERROR_KEYS[key]));
      return;
    }
    router.replace('/overview');
    router.refresh();
  }

  return (
    <AdminAuthShell>
      <div className="space-y-6">
        {expired ? (
          <Alert variant="warning" title={t('expiredTitle')}>
            {t('expiredBody')}
          </Alert>
        ) : null}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('authorised')}
          </p>
          <AdminHeading title={t('signinTitle')} description={t('signinBody')} />
        </div>
        {formError ? <Alert variant="destructive">{formError}</Alert> : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <FormField id="email" label={tf('email')} error={fe(errors.email?.message)} required>
            <Input id="email" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder={tf('emailPlaceholder')} aria-invalid={!!errors.email} {...register('email')} />
          </FormField>
          <FormField id="password" label={tf('password')} error={fe(errors.password?.message)} required>
            <PasswordField id="password" autoComplete="current-password" dir="ltr" aria-invalid={!!errors.password} {...register('password')} />
          </FormField>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              {ts('forgot')}
            </Link>
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {isSubmitting ? ts('submitting') : ts('submit')}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t('security')}</p>
        </form>
      </div>
    </AdminAuthShell>
  );
}
