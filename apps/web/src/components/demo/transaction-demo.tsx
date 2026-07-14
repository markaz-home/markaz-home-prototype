'use client';

/**
 * DEV-ONLY Week-5 preview (isolated, deletable, English-only by design). A purely
 * visual walkthrough of the post-acceptance transaction journey — static mock data
 * + local React state only. No backend, DB, RLS, payments, uploads, or real
 * offer-state changes; strings are hardcoded so it touches no shared i18n.
 * Delete `components/demo/` + `app/[locale]/demo/transaction/` to remove entirely.
 */
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleDot,
  FileText,
  Landmark,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { Alert, Badge, Button, Card, CardContent, cn } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { formatAed } from '@/lib/format';

const STEPS = ['accepted', 'overview', 'deposit', 'documents', 'transfer', 'completed'] as const;
const STORAGE_KEY = 'markaz.demoTxStep';
const ACCEPTED_AMOUNT = 1_950_000;
const DEPOSIT_AMOUNT = 195_000; // 10% — simulated only
const TRACKER_AT = [0, 1, 2, 2, 3, 4];
const TRACKER_LABELS = ['Offer accepted', 'Deposit', 'Documents', 'Transfer', 'Completed'];
const TRACKER_ICONS = [CheckCircle2, Wallet, FileText, Landmark, ShieldCheck];

const PROPERTY = {
  headline: '2-bedroom apartment in Royal JVC Building',
  location: 'Jumeirah Village Circle · Dubai',
  facts: '2 bed · 2 bath · 1,180 sq ft',
};
const BUYER = 'Buyer 01 · Verified customer';
const SELLER = 'You (seller)';
const REF = 'MKZ-TX-DEMO-0001';
const ACCEPTED_DATE = '30 June 2026';
const COMPLETED_DATE = '12 July 2026';
const DISCLOSURE =
  'This is a prototype demonstration. It does not create a legally binding agreement or any real financial or legal process.';

export function TransactionDemo() {
  const locale = useLocale();
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw != null) {
        const n = Number.parseInt(raw, 10);
        if (Number.isInteger(n) && n >= 0 && n < STEPS.length) setStep(n);
      }
    } catch {
      /* sessionStorage unavailable */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(step));
    } catch {
      /* ignore */
    }
  }, [step]);

  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  const name = STEPS[step]!;
  const amount = formatAed(ACCEPTED_AMOUNT, locale);
  const next = () => go(step + 1);

  return (
    <div className="container max-w-3xl py-8">
      <Alert variant="warning" className="mb-6">
        <p className="font-medium">Week 5 preview — demo only</p>
        <p className="text-sm">
          A visual walkthrough of what happens after an offer is accepted. No real payment,
          document, or legal process occurs.
        </p>
      </Alert>

      <Tracker step={step} />

      <div className="mt-6">
        {name === 'accepted' && <Accepted amount={amount} onNext={next} />}
        {name === 'overview' && <Overview amount={amount} onNext={next} />}
        {name === 'deposit' && <Deposit locale={locale} onNext={next} />}
        {name === 'documents' && <Documents onNext={next} />}
        {name === 'transfer' && <Transfer onNext={next} />}
        {name === 'completed' && <Completed amount={amount} />}
      </div>

      <Alert variant="info" className="mt-6">
        <p className="text-sm">{DISCLOSURE}</p>
      </Alert>

      <DemoControls step={step} onPrev={() => go(step - 1)} onNext={next} onReset={() => go(0)} />
    </div>
  );
}

// --- Progress tracker --------------------------------------------------------
function Tracker({ step }: { step: number }) {
  const current = TRACKER_AT[step]!;
  const allDone = step === STEPS.length - 1;
  return (
    <ol className="flex items-center justify-between gap-1" aria-label="Progress">
      {TRACKER_LABELS.map((label, i) => {
        const done = i < current || allDone;
        const active = i === current && !allDone;
        const Icon = TRACKER_ICONS[i]!;
        return (
          <li key={label} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1',
                  i === 0 ? 'opacity-0' : done || active ? 'bg-primary' : 'bg-border',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2',
                  done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : active
                      ? 'border-primary text-primary'
                      : 'border-border text-muted-foreground',
                )}
              >
                {done ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden />
                )}
              </span>
              <span
                className={cn(
                  'h-0.5 flex-1',
                  i === TRACKER_LABELS.length - 1 ? 'opacity-0' : done ? 'bg-primary' : 'bg-border',
                )}
                aria-hidden
              />
            </div>
            <span
              className={cn(
                'mt-2 text-xs',
                active || done ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// --- Shared bits -------------------------------------------------------------
function PropertyCard() {
  return (
    <div className="flex gap-4">
      <div
        className="from-brand-900/90 to-primary text-primary-foreground flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br"
        aria-hidden
      >
        <Building2 className="h-7 w-7" />
      </div>
      <div className="min-w-0">
        <p className="font-medium">{PROPERTY.headline}</p>
        <p className="text-muted-foreground text-sm">{PROPERTY.location}</p>
        <p className="text-muted-foreground text-sm" dir="ltr">
          {PROPERTY.facts}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={cn(strong ? 'text-lg font-semibold' : 'font-medium', 'text-end')} dir="auto">
        {value}
      </span>
    </div>
  );
}

function StepHeader({ title, badge }: { title: string; badge?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      {badge ? (
        <Badge variant="warning" className="uppercase tracking-wide">
          Demo
        </Badge>
      ) : null}
    </div>
  );
}

function NextButton({ label, onNext }: { label: string; onNext: () => void }) {
  return (
    <Button className="w-full sm:w-auto" onClick={onNext}>
      {label} <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" aria-hidden />
    </Button>
  );
}

function TaskList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((i) => (
          <li key={i} className="text-muted-foreground flex items-center gap-2 text-sm">
            <CircleDot className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden /> {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Steps -------------------------------------------------------------------
function Accepted({ amount, onNext }: { amount: string; onNext: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="text-success flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <span className="text-sm font-medium">Offer accepted</span>
        </div>
        <StepHeader title="Offer accepted" />
        <PropertyCard />
        <div>
          <Row label="Buyer" value={BUYER} />
          <Row label="Accepted amount" value={amount} strong />
          <Row label="Accepted on" value={ACCEPTED_DATE} />
        </div>
        <NextButton label="Continue to transaction" onNext={onNext} />
      </CardContent>
    </Card>
  );
}

function Overview({ amount, onNext }: { amount: string; onNext: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <StepHeader title="Transaction overview" />
        <PropertyCard />
        <div>
          <Row label="Buyer" value={BUYER} />
          <Row label="Seller" value={SELLER} />
          <Row label="Accepted amount" value={amount} strong />
          <Row label="Transaction reference" value={REF} />
          <Row label="Current stage" value="Deposit" />
          <Row label="Next action" value="Confirm the deposit to continue" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TaskList title="Buyer tasks" items={['Confirm deposit', 'Provide identification']} />
          <TaskList title="Seller tasks" items={['Confirm documents', 'Prepare for transfer']} />
        </div>
        <NextButton label="Confirm demo deposit" onNext={onNext} />
      </CardContent>
    </Card>
  );
}

function Deposit({ locale, onNext }: { locale: string; onNext: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="text-success flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <span className="text-sm font-medium">Deposit confirmed — Demo</span>
        </div>
        <StepHeader title="Deposit confirmed — Demo" badge />
        <div>
          <Row label="Simulated deposit" value={formatAed(DEPOSIT_AMOUNT, locale)} strong />
          <Row label="Confirmed on" value={ACCEPTED_DATE} />
        </div>
        <Alert variant="info">
          <p className="text-sm">
            No real payment was made. This is a simulated confirmation for the prototype.
          </p>
        </Alert>
        <NextButton label="Continue to documents" onNext={onNext} />
      </CardContent>
    </Card>
  );
}

function Documents({ onNext }: { onNext: () => void }) {
  const docs = [
    { label: 'Buyer identification', done: true },
    { label: 'Seller identification', done: true },
    { label: 'Proof of ownership', done: true },
    { label: 'MOU / Form F', done: false },
  ];
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <StepHeader title="Documents" />
        <ul className="divide-y">
          {docs.map((d) => (
            <li key={d.label} className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-2 text-sm">
                {d.done ? (
                  <CheckCircle2 className="text-success h-5 w-5" aria-hidden />
                ) : (
                  <CircleDot className="text-warning h-5 w-5" aria-hidden />
                )}
                {d.label}
              </span>
              <span
                className={cn(
                  'text-xs font-medium',
                  d.done ? 'text-muted-foreground' : 'text-warning',
                )}
              >
                {d.done ? 'Complete' : 'Ready for demo confirmation'}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">
          No real documents are created or uploaded in this demo.
        </p>
        <NextButton label="Confirm documents" onNext={onNext} />
      </CardContent>
    </Card>
  );
}

function Transfer({ onNext }: { onNext: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <StepHeader title="Transfer scheduled — Demo" badge />
        <div>
          <Row label="Location" value="Dubai Land Department (Demo) — Trade Centre 1" />
          <Row label="Date and time" value="Sunday, 12 July 2026 · 11:00" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TaskList
            title="Buyer preparation"
            items={['Bring identification', 'Confirm payment readiness']}
          />
          <TaskList
            title="Seller preparation"
            items={['Bring the title deed', 'Confirm ownership documents']}
          />
        </div>
        <Alert variant="info">
          <p className="text-sm">This is not a real DLD appointment.</p>
        </Alert>
        <NextButton label="Complete demo transaction" onNext={onNext} />
      </CardContent>
    </Card>
  );
}

function Completed({ amount }: { amount: string }) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6 text-center">
        <div className="bg-success/15 text-success mx-auto flex h-14 w-14 items-center justify-center rounded-full">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </div>
        <StepHeader title="Transaction completed — Demo" />
        <div className="mx-auto max-w-sm text-start">
          <Row label="Property" value={PROPERTY.headline} />
          <Row label="Final accepted amount" value={amount} strong />
          <Row label="Completed on" value={COMPLETED_DATE} />
        </div>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/properties">Browse properties</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Dev-only controls -------------------------------------------------------
function DemoControls({
  step,
  onPrev,
  onNext,
  onReset,
}: {
  step: number;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
}) {
  return (
    <div className="bg-muted/40 mt-8 flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 text-sm">
      <span className="text-muted-foreground font-medium">Demo controls</span>
      <span className="text-muted-foreground text-xs">
        ({step + 1}/{STEPS.length})
      </span>
      <div className="ms-auto flex gap-2">
        <Button size="sm" variant="outline" onClick={onPrev} disabled={step === 0}>
          Previous
        </Button>
        <Button size="sm" variant="outline" onClick={onNext} disabled={step === STEPS.length - 1}>
          Next
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden /> Reset
        </Button>
      </div>
    </div>
  );
}
