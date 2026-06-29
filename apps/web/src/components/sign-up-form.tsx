'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  signUpSchema,
  buildSignupMetadata,
  isLikelyExistingAccount,
  isExistingAccountError,
  mapAuthError,
  type SignUpInput,
} from '@markaz/domain';
import { Alert, Button, FormField, Input } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { Link, useRouter } from '@/i18n/navigation';
import { AuthShell, AuthHeading } from '@/components/auth/auth-shell';
import { CustomerSupportPanel } from '@/components/auth/support-panel';
import { AuthProgress } from '@/components/auth/auth-progress';
import { PasswordField } from '@/components/auth/password-field';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { ErrorSummary } from '@/components/auth/error-summary';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

const FIELDS = ['fullName', 'email', 'password', 'confirmPassword', 'acceptTerms', 'acceptPrivacy'] as const;

export function SignUpForm() {
  const t = useTranslations('signup');
  const tv = useTranslations('validation');
  const ta = useTranslations('auth');
  const tsi = useTranslations('signin');
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
  const fe = (code?: string) => (code ? tv(FIELD_ERROR_KEYS[code] ?? 'unexpectedError') : undefined);
  const errorList = FIELDS.filter((k) => errors[k]).map((k) => ({
    id: k,
    message: fe(errors[k]?.message as string | undefined) ?? '',
  }));

  async function onSubmit(data: SignUpInput) {
    setFormError(null);
    setExisting(false);
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: buildSignupMetadata(data) },
    });
    if (error) {
      // Some GoTrue configs return an explicit 422 user_already_exists instead
      // of the obfuscated empty-identities response — treat it as existing too.
      if (isExistingAccountError(error)) {
        setExisting(true);
        return;
      }
      setFormError(tv(AUTH_ERROR_KEYS[mapAuthError(error)]));
      return;
    }
    if (isLikelyExistingAccount(result.user)) {
      setExisting(true);
      return;
    }
    router.push(`/sign-up/check-email?email=${encodeURIComponent(data.email)}`);
  }

  return (
    <AuthShell support={<CustomerSupportPanel />}>
      <div className="space-y-6">
        <AuthHeading
          title={t('title')}
          description={t('description')}
          progress={<AuthProgress current={0} />}
        />

        <ErrorSummary errors={errorList} />

        {existing ? (
          <Alert variant="warning" title={tv('existingAccount')}>
            <div className="mt-2 flex gap-4 text-sm font-medium">
              <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
                {ta('signIn')}
              </Link>
              <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
                {tsi('forgot')}
              </Link>
            </div>
          </Alert>
        ) : null}
        {formError ? <Alert variant="destructive">{formError}</Alert> : null}

        <form
          onSubmit={handleSubmit(onSubmit, () => setSubmitted(true))}
          className="space-y-5"
          noValidate
        >
          <FormField id="fullName" label={t('fullName')} error={fe(errors.fullName?.message)} required>
            <Input id="fullName" autoComplete="name" placeholder={t('fullNamePlaceholder')} aria-invalid={!!errors.fullName} {...register('fullName')} />
          </FormField>

          <FormField id="email" label={t('email')} error={fe(errors.email?.message)} required>
            <Input id="email" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder={t('emailPlaceholder')} aria-invalid={!!errors.email} {...register('email')} />
          </FormField>

          <FormField id="password" label={t('password')} required>
            <PasswordField id="password" autoComplete="new-password" dir="ltr" placeholder={t('passwordPlaceholder')} aria-invalid={!!errors.password} {...register('password')} />
          </FormField>
          <PasswordChecklist password={password} submitted={submitted} />

          <FormField id="confirmPassword" label={t('confirmPassword')} error={fe(errors.confirmPassword?.message)} required>
            <PasswordField id="confirmPassword" autoComplete="new-password" dir="ltr" placeholder={t('confirmPasswordPlaceholder')} aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
          </FormField>

          <div className="space-y-2">
            <label className="flex items-start gap-3 text-sm">
              <input id="acceptTerms" type="checkbox" className="mt-1 h-4 w-4" {...register('acceptTerms')} />
              <span>{t('terms')}</span>
            </label>
            {errors.acceptTerms ? <p role="alert" className="text-xs font-medium text-destructive">{fe(errors.acceptTerms.message)}</p> : null}
            <label className="flex items-start gap-3 text-sm">
              <input id="acceptPrivacy" type="checkbox" className="mt-1 h-4 w-4" {...register('acceptPrivacy')} />
              <span>{t('privacy')}</span>
            </label>
            {errors.acceptPrivacy ? <p role="alert" className="text-xs font-medium text-destructive">{fe(errors.acceptPrivacy.message)}</p> : null}
          </div>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t('existing')}{' '}
            <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
              {ta('signIn')}
            </Link>
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
