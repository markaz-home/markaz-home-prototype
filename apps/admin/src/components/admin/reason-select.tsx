'use client';
import { useTranslations } from 'next-intl';
import { Label } from '@markaz/ui';

/**
 * Admin Reason Selector (spec §37) — approved categories only, no hidden default:
 * the empty option forces an explicit choice. `basePath` is the i18n subpath under
 * `admin` that holds one label per enum value (e.g. `customer.restrict.reason`).
 */
export function ReasonSelect({
  id,
  label,
  basePath,
  values,
  value,
  onChange,
}: {
  id: string;
  label: string;
  basePath: string;
  values: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations('admin');
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
      >
        <option value="">{`— ${t('reasonLabel')} —`}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {t(`${basePath}.${v}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Optional short free-text note attached to a controlled action. */
export function NoteField({
  id,
  label,
  value,
  onChange,
  max = 1000,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  placeholder?: string;
}) {
  const t = useTranslations('admin');
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
      />
      <p className="text-muted-foreground text-right text-xs">
        {t('charCount', { count: value.length, max })}
      </p>
    </div>
  );
}
