'use client';
import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Restrained deep-blue brand panel for customer auth (design spec §9.3). */
export function CustomerSupportPanel() {
  const t = useTranslations('authPanel');
  return (
    <div className="flex h-full flex-col justify-center rounded-xl bg-brand-900 p-8 text-brand-100">
      <h2 className="font-display text-2xl font-medium text-white">{t('title')}</h2>
      <p className="mt-3 text-brand-300">{t('subtitle')}</p>
      <ul className="mt-8 space-y-3 text-sm">
        {[t('point1'), t('point2'), t('point3')].map((item) => (
          <li key={item} className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-300" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
