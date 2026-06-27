'use client';
import { useRef } from 'react';
import { cn } from '@markaz/ui';

/**
 * Six-digit verification code (design spec §11.4): ONE logical accessible input
 * (one-time-code autofill, paste, backspace, numeric) rendered as six visual
 * cells. Digits always LTR, even in Arabic. The code is never persisted.
 */
export function OtpInput({
  value,
  onChange,
  ariaLabel,
  disabled = false,
  invalid = false,
  id = 'code',
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const focusIdx = Math.min(value.length, 5);

  return (
    <div className="relative w-fit" dir="ltr" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        disabled={disabled}
        className="absolute inset-0 z-10 h-full w-full cursor-text text-transparent caret-transparent opacity-0"
      />
      <div className="flex gap-2" aria-hidden>
        {cells.map((c, i) => (
          <div
            key={i}
            className={cn(
              'flex h-14 w-12 items-center justify-center rounded-md border bg-background text-xl font-semibold tabular-nums transition-colors',
              invalid
                ? 'border-destructive'
                : i === focusIdx && !disabled
                  ? 'border-ring ring-2 ring-ring'
                  : 'border-input',
            )}
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}
