'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { resetPasswordSchema, mapAuthError, type ResetPasswordInput } from '@markaz/domain';
import { Alert, Button, FormField } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { useRouter } from '@/i18n/navigation';
import { AuthShell, AuthHeading } from '@/components/auth/auth-shell';
import { PasswordField } from '@/components/auth/password-field';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { ErrorSummary } from '@/components/auth/error-summary';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';
import { trpc } from '@/trpc/react';

/** Reached only with a valid recovery session (established by /auth/confirm). */
export function ResetPasswordForm() {
  const t = useTranslations('reset');
  const tv = useTranslations('validation');
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const audit = trpc.audit.record.useMutation();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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
  const fe = (c?: string) => (c ? tv(FIELD_ERROR_KEYS[c] ?? 'unexpectedError') : undefined);
  const errorList = (['password', 'confirmPassword'] as const).filter((k) => errors[k]).map((k) => ({ id: k, message: fe(errors[k]?.message) ?? '' }));

  async function onSubmit(data: ResetPasswordInput) {
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: data.password });
    if (err) {
      setError(tv(AUTH_ERROR_KEYS[mapAuthError(err)]));
      return;
    }
    await audit.mutateAsync({ action: 'PASSWORD_RESET_COMPLETED' }).catch(() => {});
    // Spec §14.4: end the recovery session; require a fresh sign-in.
    await supabase.auth.signOut();
    router.replace('/reset-password/success');
  }

  return (
    <AuthShell narrow>
      <div className="space-y-6">
        <AuthHeading title={t('title')} description={t('description')} />
        <ErrorSummary errors={errorList} />
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <form onSubmit={handleSubmit(onSubmit, () => setSubmitted(true))} className="space-y-5" noValidate>
          <FormField id="password" label={t('newPassword')} required>
            <PasswordField id="password" autoComplete="new-password" dir="ltr" aria-invalid={!!errors.password} {...register('password')} />
          </FormField>
          <PasswordChecklist password={password} submitted={submitted} />
          <FormField id="confirmPassword" label={t('confirm')} error={fe(errors.confirmPassword?.message)} required>
            <PasswordField id="confirmPassword" autoComplete="new-password" dir="ltr" aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
          </FormField>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
