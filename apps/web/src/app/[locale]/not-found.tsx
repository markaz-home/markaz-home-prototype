import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@markaz/ui';

export default async function NotFound() {
  const t = await getTranslations('states');
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState title={t('notFoundTitle')} description={t('notFoundBody')} />
    </div>
  );
}
