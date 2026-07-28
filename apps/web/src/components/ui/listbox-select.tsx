'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@markaz/ui';

export interface ListboxOption {
  value: string;
  label: string;
  /** Matching-inventory count, rendered at the inline end of the row. */
  count?: number;
  disabled?: boolean;
}

export interface ListboxClassNames {
  button?: string;
  panel?: string;
  option?: string;
  optionActive?: string;
}

const DEFAULTS: Required<ListboxClassNames> = {
  button:
    'border-input bg-background hover:border-primary/50 flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 text-start text-sm outline-none focus-visible:ring-ring focus-visible:ring-2',
  panel:
    'bg-popover text-popover-foreground border-border absolute inset-x-0 top-[calc(100%+0.25rem)] z-30 max-h-72 overflow-y-auto rounded-lg border py-1.5 shadow-xl',
  option:
    'flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-start text-sm',
  optionActive: 'bg-accent text-accent-foreground',
};

/** Close on outside pointer-down. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) closeRef.current();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);
  return ref;
}

/**
 * The one dropdown used across the product (ARIA 1.2 listbox pattern).
 *
 * A native `<select>` renders an unthemable system popup — light chrome against
 * the near-black canvas — so every menu here is this button + listbox instead.
 * `classNames` lets the landing hero keep its light "glass" palette while the
 * marketplace and workspace use the surface tokens; the behaviour is shared.
 */
export function ListboxSelect({
  value,
  options,
  onChange,
  id: idProp,
  labelledBy,
  ariaLabel,
  classNames,
  buttonContent,
  wrapperClassName = 'relative',
}: {
  value: string;
  options: ListboxOption[];
  onChange: (value: string) => void;
  id?: string;
  /** Id of a visible label element (the field's `<label>`/`<span>`). */
  labelledBy?: string;
  ariaLabel?: string;
  classNames?: ListboxClassNames;
  /** Override the closed-state label (defaults to the selected option's label). */
  buttonContent?: React.ReactNode;
  /** The panel positions against this box. `contents` when the caller is the
   *  positioned ancestor (the landing hero's field). */
  wrapperClassName?: string;
}) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const matchedIndex = options.findIndex((option) => option.value === value);
  const selectedIndex =
    matchedIndex >= 0 ? matchedIndex : options.findIndex((option) => !option.disabled);
  const [active, setActive] = useState(selectedIndex);
  const wrapperRef = useDismiss(open, () => setOpen(false));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const cls = { ...DEFAULTS, ...classNames };

  useEffect(() => {
    if (open) listboxRef.current?.focus();
  }, [open]);

  function closeAndFocusButton() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function commit(index: number) {
    const option = options[index];
    if (option && !option.disabled) onChange(option.value);
    closeAndFocusButton();
  }

  function moveActive(start: number, direction: 1 | -1) {
    if (options.length === 0) return -1;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (start + direction * offset + options.length) % options.length;
      if (!options[index]?.disabled) return index;
    }
    return start;
  }

  return (
    <div ref={wrapperRef} className={wrapperClassName}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={labelledBy ? `${labelledBy} ${id}` : undefined}
        aria-label={labelledBy ? undefined : ariaLabel}
        onClick={() => {
          setActive(selectedIndex);
          setOpen((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(selectedIndex);
            setOpen(true);
          }
        }}
        className={cls.button}
      >
        <span className="truncate">{buttonContent ?? options[selectedIndex]?.label}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : ariaLabel}
          aria-activedescendant={active >= 0 ? `${listboxId}-${active}` : undefined}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((prev) => moveActive(prev, event.key === 'ArrowDown' ? 1 : -1));
            } else if (event.key === 'Home') {
              event.preventDefault();
              setActive(moveActive(-1, 1));
            } else if (event.key === 'End') {
              event.preventDefault();
              setActive(moveActive(0, -1));
            } else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              commit(active);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              closeAndFocusButton();
            } else if (event.key === 'Tab') {
              setOpen(false);
            }
          }}
          onBlur={(event) => {
            if (!wrapperRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
          }}
          className={cls.panel}
        >
          {options.map((option, index) => (
            <li
              key={option.value || 'any'}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              onMouseEnter={() => {
                if (!option.disabled) setActive(index);
              }}
              // Fires before blur, so the value still lands.
              onMouseDown={(event) => {
                event.preventDefault();
                if (!option.disabled) commit(index);
              }}
              className={cn(
                cls.option,
                index === active && cls.optionActive,
                option.value === value && 'font-semibold',
                option.disabled && 'cursor-not-allowed opacity-45',
              )}
            >
              <span className="truncate">{option.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                {option.count !== undefined && (
                  <span className="text-xs tabular-nums">{option.count}</span>
                )}
                {option.value === value && <Check className="h-3.5 w-3.5" aria-hidden />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
