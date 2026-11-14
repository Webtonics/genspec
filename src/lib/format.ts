const LOCALE = 'en-GB';

/** Number with a fixed number of decimals and thousands separators, e.g. 12,000.0 */
export function fmtNumber(value: number, decimals = 0): string {
  return value.toLocaleString(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * An input value as entered, no trailing zeros: 323.9, 9.53, 0.0981, 3.78541, 12,000.
 * Allows up to 6 decimals so constants are never shown rounded in the working.
 */
export function fmtValue(value: number, maxDecimals = 6): string {
  return value.toLocaleString(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
}

/** Duration from minutes: 10 min, 4 h, 1 h 30 min */
export function fmtMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Duration from decimal hours: 1.2242 gives 1 h 13 min */
export function fmtHours(hours: number): string {
  return fmtMinutes(hours * 60);
}

/** Date from an ISO string, e.g. 04 Nov 2026 */
export function fmtDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Simple English plural: plural(2, 'section') gives "2 sections". */
export function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : pluralNoun}`;
}
