'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Mail, ArrowLeft, Home } from 'lucide-react';
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
const RESEND_SECONDS = 30;

function classifyError(err: { message?: string; status?: number } | null): AuthError {
  if (!err) return null;
  if (err.status === 429) return 'rateLimited';
  const m = (err.message ?? '').toLowerCase();
  if (m.includes('expired')) return 'expiredCode';
  if (m.includes('invalid') || m.includes('token')) return 'invalidCode';
  return 'providerUnavailable';
}

export function SignInFlow() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<AuthError>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function sendCode(targetEmail: string, isResend = false) {
    setAuthError(null);
    setInfo(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setAuthError(classifyError(error));
      return;
    }
    setStep('otp');
    setResendIn(RESEND_SECONDS);
    if (isResend) setInfo(t('codeSent'));
  }

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setEmailError(t('emailInvalid'));
      return;
    }
    await sendCode(parsed.data);
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(null);
    setAuthError(null);
    if (!/^\d{6}$/.test(code)) {
      setCodeError(t('codeInvalidFormat'));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    setBusy(false);
    if (error) {
      setAuthError(classifyError(error));
      return;
    }
    // Session is set. Server guard routes new vs returning customers.
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Home className="h-4 w-4 text-primary" aria-hidden /> MARKAZ Home
          </span>
          <CardTitle>{step === 'email' ? t('emailTitle') : t('otpTitle')}</CardTitle>
          <CardDescription>
            {step === 'email' ? t('emailSubtitle') : t('otpSubtitle', { email })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {authError ? (
            <Alert variant={authError === 'rateLimited' ? 'warning' : 'destructive'}>
              {t(authError)}
            </Alert>
          ) : null}
          {info ? <Alert variant="success">{info}</Alert> : null}

          {step === 'email' ? (
            <form onSubmit={onSubmitEmail} className="space-y-4" noValidate>
              <FormField id="email" label={t('emailLabel')} error={emailError ?? undefined} required>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  aria-invalid={!!emailError}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
              <Button type="submit" className="w-full" loading={busy}>
                <Mail className="h-4 w-4" aria-hidden />
                {busy ? t('sending') : t('sendCode')}
              </Button>
            </form>
          ) : (
            <form onSubmit={onSubmitCode} className="space-y-4" noValidate>
              <FormField id="code" label={t('codeLabel')} error={codeError ?? undefined} required>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="\d{6}"
                  placeholder="••••••"
                  value={code}
                  aria-invalid={!!codeError}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-[0.5em]"
                />
              </FormField>
              <Button type="submit" className="w-full" loading={busy}>
                {busy ? t('verifying') : t('verify')}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setAuthError(null);
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  {t('changeEmail')}
                </button>
                <button
                  type="button"
                  className="text-primary disabled:text-muted-foreground"
                  disabled={resendIn > 0 || busy}
                  onClick={() => sendCode(email, true)}
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
