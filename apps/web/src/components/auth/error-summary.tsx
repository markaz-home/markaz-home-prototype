'use client';
import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

/** Multi-error summary (design spec §24.3). Receives focus on submit failure. */
export function ErrorSummary({ errors }: { errors: { id: string; message: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length > 1) ref.current?.focus();
  }, [errors]);
  if (errors.length < 2) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm"
    >
      <p className="flex items-center gap-2 font-medium">
        <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
        Please fix the following:
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1">
        {errors.map((e) => (
          <li key={e.id}>
            <a href={`#${e.id}`} className="underline-offset-2 hover:underline">
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
