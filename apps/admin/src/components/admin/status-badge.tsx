import { Circle, AlertTriangle, XCircle, CheckCircle2, PauseCircle } from 'lucide-react';
import { cn } from '@markaz/ui';

export type StatusTone = 'neutral' | 'info' | 'attention' | 'failed' | 'complete' | 'paused';

// Semantic tones as translucent tints on the theme's own colours: the previous
// fixed light-palette chips (amber-100/red-100/emerald-100) were built for a
// white canvas and glare on the near-black one. Icon + label still carry the
// meaning, so colour is never the only signal (§37, §41).
const TONE: Record<StatusTone, { cls: string; iconCls: string; Icon: typeof Circle }> = {
  neutral: { cls: 'bg-muted text-foreground', iconCls: 'text-muted-foreground', Icon: Circle },
  info: { cls: 'bg-primary/15 text-foreground', iconCls: 'text-primary', Icon: Circle },
  attention: {
    cls: 'bg-warning/15 text-foreground',
    iconCls: 'text-warning',
    Icon: AlertTriangle,
  },
  failed: {
    cls: 'bg-destructive/15 text-foreground',
    iconCls: 'text-destructive',
    Icon: XCircle,
  },
  complete: {
    cls: 'bg-success/15 text-foreground',
    iconCls: 'text-success',
    Icon: CheckCircle2,
  },
  paused: {
    cls: 'bg-foreground/10 text-foreground',
    iconCls: 'text-muted-foreground',
    Icon: PauseCircle,
  },
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
  const { cls, iconCls, Icon } = TONE[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        cls,
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', iconCls)} aria-hidden />
      {label}
    </span>
  );
}
