import { Circle, AlertTriangle, XCircle, CheckCircle2, PauseCircle } from 'lucide-react';
import { cn } from '@markaz/ui';

export type StatusTone = 'neutral' | 'info' | 'attention' | 'failed' | 'complete' | 'paused';

const TONE: Record<StatusTone, { cls: string; Icon: typeof Circle }> = {
  neutral: { cls: 'bg-muted text-muted-foreground', Icon: Circle },
  info: { cls: 'bg-brand-100 text-brand-800', Icon: Circle },
  attention: { cls: 'bg-amber-100 text-amber-900', Icon: AlertTriangle },
  failed: { cls: 'bg-red-100 text-red-900', Icon: XCircle },
  complete: { cls: 'bg-emerald-100 text-emerald-900', Icon: CheckCircle2 },
  paused: { cls: 'bg-slate-200 text-slate-800', Icon: PauseCircle },
};

/**
 * Status badge — text + icon, never colour-only (spec §37, §41 a11y). Tone is a
 * semantic role, not a raw enum; callers map enum → tone + label.
 */
export function StatusBadge({
  tone = 'neutral',
  label,
  className,
}: {
  tone?: StatusTone;
  label: string;
  className?: string;
}) {
  const { cls, Icon } = TONE[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        cls,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
