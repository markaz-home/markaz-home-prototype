import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Button } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { getServerApi } from '@/server/api';
import { getSession } from '@/server/session';
import { PropertyDetail } from '@/components/marketplace/property-detail';

interface PageParams {
  params: Promise<{ locale: string; publicId: string; slug: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale, publicId } = await params;
  const api = await getServerApi();
  const detail = await api.marketplace.getByPublicId({ publicId }).catch(() => null);
  const t = await getTranslations({ locale, namespace: 'error' });
  if (!detail) return { title: t('propertyTitle') };
  return { title: `${detail.headline} · MARKAZ Home`, description: detail.description ?? undefined };
}

export default async function PropertyDetailPage({ params }: PageParams) {
  const { locale, publicId } = await params;
  setRequestLocale(locale);
  const api = await getServerApi();
  const detail = await api.marketplace.getByPublicId({ publicId }).catch(() => null);

  if (!detail) {
    const t = await getTranslations('error');
    const te = await getTranslations('marketplaceEmpty');
    return (
      <div className="container max-w-xl py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">{t('propertyTitle')}</h1>
        <p className="mt-3 text-muted-foreground">{t('propertyBody')}</p>
        <Button asChild className="mt-6">
          <Link href="/properties">{te('browseAll')}</Link>
        </Button>
      </div>
    );
  }

  const session = await getSession();
  let initialSaved = false;
  if (session) {
    initialSaved = (await api.marketplace.saved.isSaved({ publicId }).catch(() => ({ saved: false }))).saved;
  }

  return <PropertyDetail detail={detail} isAuthenticated={!!session} initialSaved={initialSaved} />;
}
