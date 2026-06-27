import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@markaz/ui';

/** Intentional, translated, protected placeholder for Week 1 routes. */
export async function Placeholder({ titleKey, bodyKey }: { titleKey: string; bodyKey: string }) {
  const t = await getTranslations('placeholders');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
      <EmptyState title={t(titleKey)} description={t(bodyKey)} />
    </div>
  );
}
