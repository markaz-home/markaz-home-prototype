'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { mapAuthError } from '@markaz/domain';
import { Alert, Button } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { Link, useRouter } from '@/i18n/navigation';
import { AuthShell, AuthHeading } from '@/components/auth/auth-shell';
import { AuthProgress } from '@/components/auth/auth-progress';
import { OtpInput } from '@/components/auth/otp-input';
import { maskEmail } from '@/components/auth/util';
import { AUTH_ERROR_KEYS } from '@/components/auth/error-keys';
import { trpc } from '@/trpc/react';

const RESEND_SECONDS = 60;
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function VerifyEmailForm() {
  const t = useTranslations('verify');
  const tv = useTranslations('validation');
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const ta = useTranslations('auth');
  const audit = trpc.audit.record.useMutation();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  if (!email) {
    return (
      <AuthShell narrow>
        <AuthHeading title={t('title')} description={tv('invalidRecoverySession')} />
        <Button asChild className="mt-4 w-full">
          <Link href="/sign-up">{ta('createAccount')}</Link>
        </Button>
      </AuthShell>
    );
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\d{6}$/.test(code)) {
      setError(code.length === 0 ? tv('codeEmpty') : tv('codeIncomplete'));
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    setBusy(false);
    if (err) {
      setError(tv(AUTH_ERROR_KEYS[mapAuthError(err)]));
      setCode('');
      return;
    }
    await audit.mutateAsync({ action: 'EMAIL_VERIFIED' }).catch(() => {});
    router.replace('/verify-email/success');
    router.refresh();
  }

  async function resend() {
    setError(null);
    setInfo(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resend({ type: 'signup', email });
    setBusy(false);
    if (err) {
      setError(tv(AUTH_ERROR_KEYS[mapAuthError(err)]));
      return;
    }
    setInfo(t('resent'));
    setResendIn(RESEND_SECONDS);
  }

  return (
    <AuthShell narrow>
      <div className="space-y-6">
        <AuthHeading
          title={t('title')}
          description={t('description', { email: maskEmail(email) })}
          progress={<AuthProgress current={1} />}
        />
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        {info ? <Alert variant="success">{info}</Alert> : null}

        <form onSubmit={verify} className="space-y-5" noValidate>
          <div className="space-y-2">
            <span id="code-label" className="text-sm font-medium">
              {t('codeLabel')}
            </span>
            <OtpInput value={code} onChange={setCode} ariaLabel={t('codeLabel')} invalid={!!error} disabled={busy} />
          </div>
          <Button type="submit" className="w-full" loading={busy}>
            {busy ? t('submitting') : t('submit')}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <Link href="/sign-up" className="text-muted-foreground hover:text-foreground">
            {t('changeEmail')}
          </Link>
          <button
            type="button"
            className="text-primary disabled:text-muted-foreground"
            disabled={resendIn > 0 || busy}
            onClick={resend}
          >
            {resendIn > 0 ? t('resendIn', { time: mmss(resendIn) }) : t('resend')}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('help')}</p>
      </div>
    </AuthShell>
  );
}
