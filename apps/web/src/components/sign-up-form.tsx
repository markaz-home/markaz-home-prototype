'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { signUpSchema, buildSignupMetadata, isLikelyExistingAccount, mapAuthError, type SignUpInput } from '@markaz/domain';
import { Alert, Button, FormField, Input } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { Link, useRouter } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { PasswordField } from '@/components/auth/password-field';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

export function SignUpForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [formError, setFormError] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as never,
      acceptPrivacy: false as never,
    },
  });

  const password = watch('password') ?? '';
  const fe = (code?: string) => (code ? t(FIELD_ERROR_KEYS[code] ?? 'errGeneric') : undefined);

  async function onSubmit(data: SignUpInput) {
    setFormError(null);
    setExisting(false);
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: buildSignupMetadata(data) },
    });
    if (error) {
      setFormError(t(AUTH_ERROR_KEYS[mapAuthError(error)]));
      return;
    }
    // Supabase anti-enumeration: existing confirmed email → empty identities.
    if (isLikelyExistingAccount(result.user)) {
      setExisting(true);
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
  }

  return (
    <AuthCard
      title={t('signUpTitle')}
      description={t('signUpSubtitle')}
      footer={
        <span>
          {t('haveAccount')}{' '}
          <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
            {t('signInCta')}
          </Link>
        </span>
      }
    >
      {existing ? (
        <Alert variant="warning" title={t('existingAccountTitle')}>
          <p>{t('existingAccountBody')}</p>
          <div className="mt-2 flex gap-3 text-sm font-medium">
            <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
              {t('signInCta')}
            </Link>
            <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
              {t('forgotPassword')}
            </Link>
          </div>
        </Alert>
      ) : null}
      {formError ? <Alert variant="destructive">{formError}</Alert> : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField id="fullName" label={t('fullNameLabel')} error={fe(errors.fullName?.message)} required>
          <Input id="fullName" autoComplete="name" placeholder={t('fullNamePlaceholder')} aria-invalid={!!errors.fullName} {...register('fullName')} />
        </FormField>

        <FormField id="email" label={t('emailLabel')} error={fe(errors.email?.message)} required>
          <Input id="email" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder={t('emailPlaceholder')} aria-invalid={!!errors.email} {...register('email')} />
        </FormField>

        <FormField id="password" label={t('passwordLabel')} error={fe(errors.password?.message)} required>
          <PasswordField id="password" autoComplete="new-password" dir="ltr" toggleLabel={t('showPassword')} aria-invalid={!!errors.password} {...register('password')} />
        </FormField>
        <PasswordChecklist password={password} />

        <FormField id="confirmPassword" label={t('confirmPasswordLabel')} error={fe(errors.confirmPassword?.message)} required>
          <PasswordField id="confirmPassword" autoComplete="new-password" dir="ltr" toggleLabel={t('showPassword')} aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
        </FormField>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" {...register('acceptTerms')} />
          <span>{t('consentTerms')}</span>
        </label>
        {errors.acceptTerms ? <p role="alert" className="text-xs font-medium text-destructive">{fe(errors.acceptTerms.message)}</p> : null}

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" {...register('acceptPrivacy')} />
          <span>{t('consentPrivacy')}</span>
        </label>
        {errors.acceptPrivacy ? <p role="alert" className="text-xs font-medium text-destructive">{fe(errors.acceptPrivacy.message)}</p> : null}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {isSubmitting ? t('creatingAccount') : t('createAccount')}
        </Button>
      </form>
    </AuthCard>
  );
}
