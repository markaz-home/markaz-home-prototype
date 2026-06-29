'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { resetPasswordSchema, mapAuthError, type ResetPasswordInput } from '@markaz/domain';
import { Alert, Button, FormField } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { useRouter } from '@/i18n/navigation';
import { AdminAuthShell, AdminHeading } from '@/components/auth/admin-auth-shell';
import { PasswordField } from '@/components/auth/password-field';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

export function AdminResetPassword() {
  const t = useTranslations('admin');
  const tr = useTranslations('reset');
  const tv = useTranslations('validation');
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirmPassword: '' },
  });
  const password = watch('password') ?? '';
  const fe = (c?: string) => (c ? tv(FIELD_ERROR_KEYS[c] ?? 'unexpectedError') : undefined);

  async function onSubmit(data: ResetPasswordInput) {
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: data.password });
    if (err) { setError(tv(AUTH_ERROR_KEYS[mapAuthError(err)])); return; }
    await supabase.auth.signOut();
    router.replace('/reset-password/success');
  }

  return (
    <AdminAuthShell>
      <div className="space-y-6">
        <AdminHeading title={t('resetTitle')} description={t('resetBody')} />
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <form onSubmit={handleSubmit(onSubmit, () => setSubmitted(true))} className="space-y-5" noValidate>
          <FormField id="password" label={tr('newPassword')} required>
            <PasswordField id="password" autoComplete="new-password" dir="ltr" aria-invalid={!!errors.password} {...register('password')} />
          </FormField>
          <PasswordChecklist password={password} submitted={submitted} />
          <FormField id="confirmPassword" label={tr('confirm')} error={fe(errors.confirmPassword?.message)} required>
            <PasswordField id="confirmPassword" autoComplete="new-password" dir="ltr" aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
          </FormField>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {isSubmitting ? tr('submitting') : tr('submit')}
          </Button>
        </form>
      </div>
    </AdminAuthShell>
  );
}
