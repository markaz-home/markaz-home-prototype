import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/session';
import { OfferForm } from '@/components/offers/offer-form';

interface PageParams {
  params: Promise<{ locale: string; publicId: string; slug: string }>;
}

/**
 * Buyer offer creation route (offers-design-spec §9.3). Requires an authenticated
 * session — the anonymous interception stores a safe intent and returns here after
 * sign-in. Eligibility (owner / availability / onboarding / active thread) is
 * re-checked server-side inside OfferForm via tRPC.
 */
export default async function MakeOfferPage({ params }: PageParams) {
  const { locale, publicId, slug } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!session) redirect(`/${locale}/properties/${publicId}/${slug}`);
  return <OfferForm publicId={publicId} slug={slug} />;
}
