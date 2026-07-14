'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { profileSetupSchema, type ProfileSetupInput } from '@markaz/domain';
import { Alert, Button, FormField, Input, StatusBadge } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import { AuthShell, AuthHeading } from '@/components/auth/auth-shell';
import { AuthProgress, type StepStatus } from '@/components/auth/auth-progress';
import { ErrorSummary } from '@/components/auth/error-summary';
import { FIELD_ERROR_KEYS } from '@/components/auth/error-keys';

export function ProfileSetupForm({ email }: { email?: string | null }) {
  const t = useTranslations('profile');
  const tv = useTranslations('validation');
  const ts = useTranslations('signup');
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileSetupInput>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: { fullName: '', acceptTerms: false as never, acceptPrivacy: false as never },
  });

  const mutation = trpc.profile.completeSetup.useMutation({
    onSuccess: () => {
      router.replace('/onboarding/uae-pass');
    },
    onError: () => setSaveError(tv('unexpectedError')),
  });

  const fe = (c?: string) => (c ? tv(FIELD_ERROR_KEYS[c] ?? 'unexpectedError') : undefined);
  const errorList = (['fullName', 'acceptTerms', 'acceptPrivacy'] as const)
    .filter((k) => errors[k])
    .map((k) => ({ id: k, message: fe(errors[k]?.message) ?? '' }));
  // Setup-status resume variant (spec §9.7): account details needs attention.
  const statuses: StepStatus[] = ['action', 'complete', 'upcoming'];

  return (
    <AuthShell narrow>
      <div className="space-y-6">
        <AuthHeading
          title={t('title')}
          description={t('descriptionOne')}
          progress={<AuthProgress current={0} statuses={statuses} />}
        />
        <ErrorSummary errors={errorList} />
        {saveError ? <Alert variant="destructive">{saveError}</Alert> : null}

        {email ? (
          <div className="bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground" dir="ltr">
              {email}
            </span>
            <StatusBadge tone="success">{t('verifiedEmail')}</StatusBadge>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit((d) => {
            setSaveError(null);
            mutation.mutate(d);
          })}
          className="space-y-5"
          noValidate
        >
          <FormField
            id="fullName"
            label={ts('fullName')}
            error={fe(errors.fullName?.message)}
            required
          >
            <Input
              id="fullName"
              autoComplete="name"
              placeholder={ts('fullNamePlaceholder')}
              aria-invalid={!!errors.fullName}
              {...register('fullName')}
            />
          </FormField>

          <label className="flex items-start gap-3 text-sm">
            <input
              id="acceptTerms"
              type="checkbox"
              className="mt-1 h-4 w-4"
              {...register('acceptTerms')}
            />
            <span>{ts('terms')}</span>
          </label>
          {errors.acceptTerms ? (
            <p role="alert" className="text-destructive text-xs font-medium">
              {fe(errors.acceptTerms.message)}
            </p>
          ) : null}
          <label className="flex items-start gap-3 text-sm">
            <input
              id="acceptPrivacy"
              type="checkbox"
              className="mt-1 h-4 w-4"
              {...register('acceptPrivacy')}
            />
            <span>{ts('privacy')}</span>
          </label>
          {errors.acceptPrivacy ? (
            <p role="alert" className="text-destructive text-xs font-medium">
              {fe(errors.acceptPrivacy.message)}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={mutation.isPending}>
            {mutation.isPending ? t('submitting') : t('submit')}
          </Button>
          <p className="text-muted-foreground text-center text-xs">{t('reassurance')}</p>
        </form>
      </div>
    </AuthShell>
  );
}
