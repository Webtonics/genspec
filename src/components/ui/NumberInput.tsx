import { useEffect, useState } from 'react';
import { cx } from '@/lib/cx';

type NumberInputProps = {
  value: number | null;
  /** Called with every valid value while typing, so results update live. */
  onChange: (value: number | null) => void;
  /** Allow clearing the field to null, e.g. a client spec factor not entered yet. */
  allowEmpty?: boolean;
  min?: number;
  /** Require values strictly greater than min. */
  exclusiveMin?: boolean;
  suffix?: string;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
};

/**
 * Numeric field that keeps the raw text while focused (so "1." or "0.0" can be
 * typed) and only reports values that parse and pass the bounds. Invalid text is
 * outlined and reverts to the stored value on blur.
 */
export function NumberInput({
  value,
  onChange,
  allowEmpty,
  min,
  exclusiveMin,
  suffix,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: NumberInputProps) {
  const canonical = value === null ? '' : String(value);
  const [text, setText] = useState(canonical);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(canonical);
  }, [canonical, focused]);

  const parse = (raw: string): { ok: boolean; value: number | null } => {
    const trimmed = raw.trim().replace(/,/g, '');
    if (trimmed === '') return { ok: Boolean(allowEmpty), value: null };
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return { ok: false, value: null };
    if (min !== undefined && (exclusiveMin ? n <= min : n < min)) return { ok: false, value: n };
    return { ok: true, value: n };
  };

  const invalid = focused && !parse(text).ok;

  return (
    <div
      className={cx(
        'inline-flex h-8 items-center rounded-md border bg-surface transition-colors',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        invalid ? 'border-red-500 ring-2 ring-red-500/20' : 'border-line hover:border-line-strong',
        className,
      )}
    >
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parse(e.target.value);
          if (parsed.ok && parsed.value !== value) onChange(parsed.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="h-full w-full min-w-0 bg-transparent px-2 text-right text-sm tabular-nums text-ink outline-none placeholder:text-muted/70"
      />
      {suffix && <span className="shrink-0 whitespace-nowrap pr-2 text-xs text-muted">{suffix}</span>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink outline-none transition-colors',
        'hover:border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20',
        className,
      )}
    />
  );
}
