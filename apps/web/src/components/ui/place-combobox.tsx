'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { cn } from '@markaz/ui';
import { trpc } from '@/trpc/react';

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

/**
 * Location type-ahead over the provider gazetteer (ARIA 1.2 combobox: list
 * popup, `aria-activedescendant`, free text allowed).
 *
 * Free text is deliberate — a seller whose building is missing from the
 * gazetteer must still be able to submit. Suggestions assist; they never gate.
 */
export function PlaceCombobox({
  id,
  value,
  onChange,
  placeholder,
  kind = 'AREA',
  className,
  classNames,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  kind?: 'AREA' | 'BUILDING';
  className?: string;
  classNames?: {
    wrapper?: string;
    panel?: string;
    option?: string;
    optionActive?: string;
    status?: string;
  };
}) {
  const locale = useLocale();
  const t = useTranslations('common');
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [debounced, setDebounced] = useState(value);
  // A pick shouldn't immediately re-query for the text it just wrote.
  const justPicked = useRef(false);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      setDebounced('');
      return;
    }
    const timer = setTimeout(() => setDebounced(value.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const q = trpc.externalProperties.locations.useQuery(
    { query: debounced, locale: locale === 'ar' ? 'ar' : 'en', kind },
    {
      enabled: debounced.length >= MIN_QUERY,
      staleTime: 24 * 60 * 60 * 1_000,
      retry: false,
      // Hold the previous list while the next query resolves, so the panel does
      // not blink empty between keystrokes.
      placeholderData: (prev) => prev,
    },
  );
  const suggestions = useMemo(() => q.data ?? [], [q.data]);
  const searchable = value.trim().length >= MIN_QUERY;
  // The panel is the only place status is reported: it opens once the field is
  // searchable and its CONTENT swaps (searching → rows / no matches), so nothing
  // appears, disappears or shifts underneath while a request is in flight.
  const searching = q.isFetching && suggestions.length === 0;
  const queryFailed = q.isError;
  const noMatches = !q.isFetching && !queryFailed && q.isFetched && suggestions.length === 0;
  const isOpen = open && searchable;

  useEffect(() => {
    if (suggestions.length === 0 || active >= suggestions.length) setActive(-1);
  }, [active, suggestions.length]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function choose(name: string) {
    justPicked.current = true;
    onChange(name);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div ref={wrapperRef} className={cn('relative', classNames?.wrapper)}>
      <input
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && active >= 0 ? `${listboxId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            if (suggestions.length === 0) {
              setActive(-1);
              return;
            }
            setActive((prev) => (prev + 1) % Math.max(suggestions.length, 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (suggestions.length === 0) {
              setActive(-1);
              return;
            }
            setActive((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
          } else if (event.key === 'Enter' && isOpen && active >= 0) {
            const suggestion = suggestions[active];
            if (suggestion) {
              // Take the highlighted suggestion instead of submitting the form.
              event.preventDefault();
              choose(suggestion.name);
            }
          } else if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          }
        }}
        className={cn(
          'border-input bg-background h-10 w-full rounded-md border px-3 text-sm',
          className,
        )}
      />

      {isOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          className={cn(
            'bg-popover text-popover-foreground border-border absolute inset-x-0 top-[calc(100%+0.25rem)] z-30 max-h-72 overflow-y-auto rounded-lg border py-1.5 shadow-xl',
            classNames?.panel,
          )}
        >
          {queryFailed ? (
            <li className={cn('text-warning px-3 py-2 text-sm', classNames?.status)}>
              {t('suggestionsUnavailable')}
            </li>
          ) : searching ? (
            <li
              className={cn(
                'text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm',
                classNames?.status,
              )}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t('searching')}
            </li>
          ) : noMatches ? (
            <li className={cn('text-muted-foreground px-3 py-2 text-sm', classNames?.status)}>
              {t('noMatches')}
            </li>
          ) : null}
          {suggestions.map((place, index) => (
            <li
              key={place.id}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              // Fires before the input's blur, so the value still lands.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place.name);
              }}
              className={cn(
                'cursor-pointer px-3 py-2 text-start text-sm',
                classNames?.option,
                index === active &&
                  (classNames?.optionActive ?? 'bg-accent text-accent-foreground'),
              )}
            >
              <span className="block truncate">{place.name}</span>
              {place.context ? (
                <span className="text-muted-foreground block truncate text-xs">
                  {place.context}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
