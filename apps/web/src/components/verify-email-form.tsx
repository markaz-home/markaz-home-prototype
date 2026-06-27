'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { mapAuthError } from '@markaz/domain';
import { Alert, Button, FormField, Input } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { Link, useRouter } from '@/i18n/navigation';
import { AuthCard, maskEmail } from '@/components/auth/auth-card';
import { AUTH_ERROR_KEYS } from '@/components/auth/error-keys';
import { trpc } from '@/trpc/react';

const RESEND_SECONDS = 30;

export function VerifyEmailForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const [supabase] = useState(() => createSupabaseBrowserClient());
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
      <AuthCard title={t('verifyTitle')} description={t('errSessionMissing')}>
        <Button asChild className="w-full">
          <Link href="/sign-up">{t('createAccount')}</Link>
        </Button>
      </AuthCard>
    );
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\d{6}$/.test(code)) {
      setError(t('errInvalidCode'));
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    setBusy(false);
    if (err) {
      setError(t(AUTH_ERROR_KEYS[mapAuthError(err)]));
      return;
    }
    // Email verified → a session now exists. Best-effort audit, then route.
    await audit.mutateAsync({ action: 'EMAIL_VERIFIED' }).catch(() => {});
    router.replace('/dashboard');
    router.refresh();
  }

  async function resend() {
    setError(null);
    setInfo(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resend({ type: 'signup', email });
    setBusy(false);
    if (err) {
      setError(t(AUTH_ERROR_KEYS[mapAuthError(err)]));
      return;
    }
    setInfo(t('codeSent'));
    setResendIn(RESEND_SECONDS);
  }

  return (
    <AuthCard title={t('verifyTitle')} description={t('verifySubtitle', { email: maskEmail(email) })}>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {info ? <Alert variant="success">{info}</Alert> : null}
      <form onSubmit={verify} className="space-y-4" noValidate>
        <FormField id="code" label={t('codeLabel')} required>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            dir="ltr"
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="text-center text-lg tracking-[0.5em]"
          />
        </FormField>
        <Button type="submit" className="w-full" loading={busy}>
          {busy ? t('verifying') : t('verifyCta')}
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
          {resendIn > 0 ? t('resendIn', { seconds: resendIn }) : t('resend')}
        </button>
      </div>
    </AuthCard>
  );
}
