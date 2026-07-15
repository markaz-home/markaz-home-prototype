'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SuccessPanel } from '@/components/auth/status-panels';

/** C-13 Recovery Email Sent (always generic). */
export function RecoveryEmailSent() {
  const t = useTranslations('forgot');
  return (
    <AuthShell narrow>
      <SuccessPanel title={t('sentTitle')} description={t('sentBody')}>
        <p className="text-muted-foreground text-sm">{t('sentHelp')}</p>
        <div className="flex flex-col gap-3 pt-2">
          <Button asChild>
            <Link href="/sign-in">{t('return')}</Link>
          </Button>
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground text-center text-sm"
          >
            {t('changeEmail')}
          </Link>
        </div>
      </SuccessPanel>
    </AuthShell>
  );
}
