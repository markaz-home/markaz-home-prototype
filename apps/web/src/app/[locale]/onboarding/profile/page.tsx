import { setRequestLocale } from 'next-intl/server';
import { requireCustomerStep } from '@/server/session';
import { ProfileSetupForm } from '@/components/profile-setup-form';

export default async function ProfileOnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerStep(locale, ['profile-setup']);
  return <ProfileSetupForm />;
}
