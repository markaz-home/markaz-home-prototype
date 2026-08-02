import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

/** Retired onboarding checkpoint. Stale bookmarks continue safely. */
export default async function UaePassPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect(`/${locale}/dashboard`);
}
