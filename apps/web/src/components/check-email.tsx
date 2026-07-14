'use client';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SuccessPanel } from '@/components/auth/status-panels';
import { maskEmail } from '@/components/auth/util';

/** C-03 Account Created / Check Your Email. */
export function CheckEmail() {
  const t = useTranslations('verify');
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  return (
    <AuthShell narrow>
      <SuccessPanel
        title={t('checkEmailTitle')}
        description={t('sentCode', { email: maskEmail(email) })}
      >
        <p className="text-muted-foreground text-sm">{t('checkEmailBody')}</p>
        <div className="flex flex-col gap-3 pt-2">
          <Button asChild>
            <Link href={`/verify-email?email=${encodeURIComponent(email)}`}>{t('enterCode')}</Link>
          </Button>
          <Link
            href="/sign-up"
            className="text-muted-foreground hover:text-foreground text-center text-sm"
          >
            {t('changeEmail')}
          </Link>
        </div>
        <p className="text-muted-foreground pt-2 text-xs">{t('help')}</p>
      </SuccessPanel>
    </AuthShell>
  );
}
