import { useTranslations } from 'next-intl';
import { Alert, DemoBadge } from '@markaz/ui';

/** Always-visible disclosure for simulated flows (UAE PASS, etc.). */
export function DemoDisclosure({ message }: { message: string }) {
  return (
    <Alert variant="warning">
      <div className="flex items-center gap-2">
        <DemoBadge />
        <span>{message}</span>
      </div>
    </Alert>
  );
}

export function DemoDisclosureI18n() {
  const t = useTranslations('uaePass');
  return <DemoDisclosure message={t('disclosure')} />;
}
