import { setRequestLocale, getTranslations } from 'next-intl/server';
import { EmptyState } from '@markaz/ui';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('navOffers')}</h1>
      <EmptyState title={t('navOffers')} description={t('sectionPlaceholder')} />
    </div>
  );
}
