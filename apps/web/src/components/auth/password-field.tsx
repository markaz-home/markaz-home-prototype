'use client';
import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input, cn, type InputProps } from '@markaz/ui';

/** Password input with an accessible show/hide toggle. Paste is allowed. */
export const PasswordField = React.forwardRef<
  HTMLInputElement,
  InputProps & { toggleLabel?: string }
>(({ className, toggleLabel = 'Show password', ...props }, ref) => {
  const t = useTranslations('common');
  const [show, setShow] = React.useState(false);
  const resolvedToggleLabel =
    toggleLabel === 'Show password' ? (show ? t('hidePassword') : t('showPassword')) : toggleLabel;
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={show ? 'text' : 'password'}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn('pe-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={resolvedToggleLabel}
        aria-pressed={show}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 end-0 flex items-center rounded-e-md px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        {show ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
});
PasswordField.displayName = 'PasswordField';
