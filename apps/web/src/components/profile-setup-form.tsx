'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { profileSetupSchema, type ProfileSetupInput } from '@markaz/domain';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';

const MESSAGE_KEYS: Record<string, string> = {
  full_name_too_short: 'fullNameTooShort',
  full_name_too_long: 'fullNameTooShort',
  terms_required: 'termsRequired',
  privacy_required: 'privacyRequired',
};

export function ProfileSetupForm() {
  const t = useTranslations('profile');
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
      router.refresh();
    },
    onError: () => setSaveError(t('saveError')),
  });

  function tError(code?: string): string | undefined {
    if (!code) return undefined;
    const key = MESSAGE_KEYS[code];
    return key ? t(key) : code;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {saveError ? (
            <Alert variant="destructive" className="mb-4">
              {saveError}
            </Alert>
          ) : null}
          <form
            onSubmit={handleSubmit((data) => {
              setSaveError(null);
              mutation.mutate(data);
            })}
            className="space-y-4"
            noValidate
          >
            <FormField
              id="fullName"
              label={t('fullNameLabel')}
              error={tError(errors.fullName?.message)}
              required
            >
              <Input
                id="fullName"
                placeholder={t('fullNamePlaceholder')}
                autoComplete="name"
                aria-invalid={!!errors.fullName}
                {...register('fullName')}
              />
            </FormField>

            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" {...register('acceptTerms')} />
              <span>{t('acceptTerms')}</span>
            </label>
            {errors.acceptTerms ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {tError(errors.acceptTerms.message)}
              </p>
            ) : null}

            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" {...register('acceptPrivacy')} />
              <span>{t('acceptPrivacy')}</span>
            </label>
            {errors.acceptPrivacy ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {tError(errors.acceptPrivacy.message)}
              </p>
            ) : null}

            <Button type="submit" className="w-full" loading={mutation.isPending}>
              {mutation.isPending ? t('saving') : t('save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
