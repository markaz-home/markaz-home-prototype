'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { ShieldCheck } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { useRouter } from '@/i18n/navigation';

type Step = 'email' | 'otp';
type AuthError = 'invalidCode' | 'expiredCode' | 'rateLimited' | 'providerUnavailable' | null;

const emailSchema = z.string().email();

function classify(err: { message?: string; status?: number } | null): AuthError {
  if (!err) return null;
  if (err.status === 429) return 'rateLimited';
  const m = (err.message ?? '').toLowerCase();
  if (m.includes('expired')) return 'expiredCode';
  if (m.includes('invalid') || m.includes('token')) return 'invalidCode';
  return 'providerUnavailable';
}

export function AdminSignInFlow() {
  const t = useTranslations('auth');
  const ta = useTranslations('admin');
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [authError, setAuthError] = useState<AuthError>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) return setEmailError(t('emailInvalid'));
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) return setAuthError(classify(error));
    setStep('otp');
    setResendIn(30);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    if (!/^\d{6}$/.test(code)) return setAuthError('invalidCode');
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    setBusy(false);
    if (error) return setAuthError(classify(error));
    router.replace('/overview');
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> {ta('appName')}
          </span>
          <CardTitle>{ta('loginTitle')}</CardTitle>
          <CardDescription>{ta('loginSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {authError ? (
            <Alert variant={authError === 'rateLimited' ? 'warning' : 'destructive'}>
              {t(authError)}
            </Alert>
          ) : null}
          {step === 'email' ? (
            <form onSubmit={send} className="space-y-4" noValidate>
              <FormField id="email" label={t('emailLabel')} error={emailError ?? undefined} required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  aria-invalid={!!emailError}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
              <Button type="submit" className="w-full" loading={busy}>
                {busy ? t('sending') : t('sendCode')}
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4" noValidate>
              <FormField id="code" label={t('codeLabel')} required>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-[0.5em]"
                />
              </FormField>
              <Button type="submit" className="w-full" loading={busy}>
                {busy ? t('verifying') : t('verify')}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setStep('email')}>
                  {t('changeEmail')}
                </button>
                <button
                  type="button"
                  className="text-primary disabled:text-muted-foreground"
                  disabled={resendIn > 0 || busy}
                  onClick={() => send(new Event('submit') as unknown as React.FormEvent)}
                >
                  {resendIn > 0 ? t('resendIn', { seconds: resendIn }) : t('resend')}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
