'use client';
import { useTranslations } from 'next-intl';
import { ErrorState } from '@markaz/ui';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('states');
  const c = useTranslations('common');
  return (
    <ErrorState
      title={t('errorTitle')}
      description={t('errorBody')}
      retryLabel={c('retry')}
      onRetry={reset}
    />
  );
}
