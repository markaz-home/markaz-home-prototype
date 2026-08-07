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
import { AuthProgress } from '@/components/auth/auth-progress';
import { PasswordField } from '@/components/auth/password-field';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { ProviderAuthButtons } from '@/components/auth/provider-auth-buttons';
import { ConsentCheckbox } from '@/components/auth/consent-checkbox';
import { FIELD_ERROR_KEYS, AUTH_ERROR_KEYS } from '@/components/auth/error-keys';

export function SignUpForm({
  googleEnabled = false,
  uaePassEnabled = false,
  locale = 'en',
}: {
  googleEnabled?: boolean;
  uaePassEnabled?: boolean;
  locale?: string;
}) {
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
    setValue,
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
  // One control, both consents. The schema and `profiles` keep separate
  // `acceptTerms`/`acceptPrivacy` flags (and separate accepted-at timestamps),
  // so the record of what was agreed to is unchanged — only the UI is combined.
  const acceptedAll = !!watch('acceptTerms') && !!watch('acceptPrivacy');
  const consentError = errors.acceptTerms ?? errors.acceptPrivacy;
  function setConsent(accepted: boolean) {
    setValue('acceptTerms', accepted as never, { shouldValidate: submitted });
    setValue('acceptPrivacy', accepted as never, { shouldValidate: submitted });
  }
  const fe = (code?: string) =>
    code ? tv(FIELD_ERROR_KEYS[code] ?? 'unexpectedError') : undefined;
  // The live checklist covers min-length + policy; surface the max-length (128)
  // error under the field too (design spec §2194 — never a silent truncation).
  const passwordFieldError =
    errors.password?.message === 'password_too_long' ? fe('password_too_long') : undefined;

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
    // No support panel: the card is centred and runs wide for the two-column form.
    <AuthShell>
      <div className="space-y-3">
        <AuthHeading title={t('title')} progress={<AuthProgress current={0} />} />

        {existing ? (
          /* The form yields to the warning entirely: the way forward is Sign In,
             not silently retrying the same details (anti-enumeration copy). */
          <div className="space-y-5">
            <Alert variant="warning" title={tv('existingAccount')}>
              <p className="text-muted-foreground mt-1 text-sm">{tv('existingAccountBody')}</p>
            </Alert>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/sign-in">{ta('signIn')}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/forgot-password">{tsi('forgot')}</Link>
              </Button>
              <button
                type="button"
                onClick={() => setExisting(false)}
                className="text-muted-foreground hover:text-foreground w-full text-center text-sm underline-offset-4 hover:underline"
              >
                {t('tryDifferentEmail')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {formError ? <Alert variant="destructive">{formError}</Alert> : null}

            <ProviderAuthButtons
              intent="sign-up"
              locale={locale}
              googleEnabled={googleEnabled}
              uaePassEnabled={uaePassEnabled}
              onError={(message) => setFormError(message || null)}
            />

            <form
              onSubmit={handleSubmit(onSubmit, (formErrors) => {
                setSubmitted(true);
                // react-hook-form focuses the first invalid registered field. The
                // consent box is controlled (it writes both flags), so focus it here
                // when it is the only thing left to fix.
                const fieldInvalid = ['fullName', 'email', 'password', 'confirmPassword'].some(
                  (key) => key in formErrors,
                );
                if (!fieldInvalid && (formErrors.acceptTerms || formErrors.acceptPrivacy)) {
                  document.getElementById('acceptConsent')?.focus();
                }
              })}
              className="space-y-3"
              noValidate
            >
              <div className="space-y-3">
                <FormField
                  id="fullName"
                  label={t('fullName')}
                  error={fe(errors.fullName?.message)}
                  required
                >
                  <Input
                    id="fullName"
                    autoComplete="name"
                    placeholder={t('fullNamePlaceholder')}
                    aria-invalid={!!errors.fullName}
                    {...register('fullName')}
                  />
                </FormField>

                <FormField id="email" label={t('email')} error={fe(errors.email?.message)} required>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    dir="ltr"
                    placeholder={t('emailPlaceholder')}
                    aria-invalid={!!errors.email}
                    {...register('email')}
                  />
                </FormField>

                <FormField id="password" label={t('password')} error={passwordFieldError} required>
                  <PasswordField
                    id="password"
                    autoComplete="new-password"
                    dir="ltr"
                    placeholder={t('passwordPlaceholder')}
                    aria-invalid={!!errors.password}
                    {...register('password')}
                  />
                </FormField>

                <PasswordChecklist password={password} submitted={submitted} />

                <FormField
                  id="confirmPassword"
                  label={t('confirmPassword')}
                  error={fe(errors.confirmPassword?.message)}
                  required
                >
                  <PasswordField
                    id="confirmPassword"
                    autoComplete="new-password"
                    dir="ltr"
                    placeholder={t('confirmPasswordPlaceholder')}
                    aria-invalid={!!errors.confirmPassword}
                    {...register('confirmPassword')}
                  />
                </FormField>
              </div>

              <ConsentCheckbox
                checked={acceptedAll}
                onChange={setConsent}
                error={fe(consentError?.message as string | undefined)}
              />

              <Button type="submit" className="w-full" loading={isSubmitting}>
                {isSubmitting ? t('submitting') : t('submit')}
              </Button>
              <p className="text-muted-foreground text-center text-sm">
                {t('existing')}{' '}
                <Link
                  href="/sign-in"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  {ta('signIn')}
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
