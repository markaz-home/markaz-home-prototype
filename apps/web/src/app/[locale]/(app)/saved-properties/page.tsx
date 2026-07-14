import { setRequestLocale } from 'next-intl/server';
import { SavedProperties } from '@/components/marketplace/saved-properties';

export default async function SavedPropertiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SavedProperties />;
}
