'use client';
import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Premium, restrained brand panel for customer auth (design spec §9.3). */
export function CustomerSupportPanel() {
  const t = useTranslations('authPanel');
  return (
    <div className="bg-card/70 flex h-full flex-col justify-center rounded-xl border p-8 backdrop-blur-sm">
      <div className="bg-primary mb-7 h-px w-16" aria-hidden />
      <h2 className="font-display text-primary text-2xl font-medium">{t('title')}</h2>
      <p className="text-muted-foreground mt-3">{t('subtitle')}</p>
      <ul className="mt-8 space-y-3 text-sm">
        {[t('point1'), t('point2'), t('point3')].map((item) => (
          <li key={item} className="flex items-center gap-2.5">
            <CheckCircle2 className="text-primary h-4 w-4 shrink-0" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
