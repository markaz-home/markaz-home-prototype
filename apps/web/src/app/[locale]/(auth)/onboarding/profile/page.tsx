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
  const session = await requireCustomerStep(locale, ['profile-setup']);
  const provider = session.uaePassAuthenticated
    ? 'uae-pass'
    : session.googleAuthenticated
      ? 'google'
      : null;
  return (
    <ProfileSetupForm
      email={session.email}
      emailVerified={session.emailVerified || session.providerAuthenticated}
      initialName={session.profile?.fullName}
      initialPhone={session.profile?.phoneE164}
      provider={provider}
    />
  );
}
