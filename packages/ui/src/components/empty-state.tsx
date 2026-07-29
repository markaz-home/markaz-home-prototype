import * as React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../lib/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Omit for the default inbox glyph; pass `null` for no icon at all. */
  icon?: React.ReactNode | null;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  const glyph = icon === undefined ? <Inbox className="h-8 w-8" /> : icon;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center',
        className,
      )}
    >
      {glyph ? (
        <div className="text-muted-foreground" aria-hidden>
          {glyph}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
