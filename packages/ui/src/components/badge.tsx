import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        primary: 'border-transparent bg-primary text-primary-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Always-visible label that content is a clearly-marked demo simulation. */
export function DemoBadge({
  className,
  label = 'Demo',
  ...props
}: BadgeProps & { label?: string }) {
  return (
    <Badge variant="warning" className={cn('uppercase tracking-wide', className)} {...props}>
      {label}
    </Badge>
  );
}

type StatusTone = 'neutral' | 'success' | 'warning' | 'destructive' | 'primary';

const STATUS_TONE: Record<StatusTone, BadgeProps['variant']> = {
  neutral: 'default',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
  primary: 'primary',
};

export function StatusBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_TONE[tone]} className={className}>
      {children}
    </Badge>
  );
}

export { badgeVariants };
