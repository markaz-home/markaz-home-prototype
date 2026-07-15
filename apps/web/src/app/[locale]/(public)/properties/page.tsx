import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { MarketplaceBrowse } from '@/components/marketplace/marketplace-browse';
import { getSession } from '@/server/session';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketplace' });
  return { title: `${t('titleUae')} · MARKAZ Home`, description: t('description') };
}

export default async function PropertiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  // Dubai-first prototype: the active marketplace is Dubai.
  return <MarketplaceBrowse isAuthenticated={!!session} scope="dubai" />;
}
