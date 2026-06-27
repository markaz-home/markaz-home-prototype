import { setRequestLocale } from 'next-intl/server';
import { SignInFlow } from '@/components/sign-in-flow';

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignInFlow />;
}
