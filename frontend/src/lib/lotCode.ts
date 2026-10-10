/**
 * Box lot code: 2 letters (prefix) + YYMMDD + optional extra digits + 2-6 product letters,
 * e.g. TA260806KRM. Only the first 6 digits after the prefix are the production date.
 */
export const LOT_CODE_REGEX = /^([A-Z]{2})(\d{6})(\d*)([A-Z]{2,6})$/;

export const DEFAULT_LOT_PREFIX = 'TA';

/** First 3 letters of a product name, upper-case ("Kroom rectangulaire" -> "KRO"). */
export const defaultLotLetters = (name: string): string =>
  name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();

/** "2026-08-06" -> "260806" */
export const yymmdd = (isoDate: string): string => {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${y.slice(2)}${m}${d}`;
};

export const suggestLotCode = (prefix: string, isoDate: string, letters: string): string =>
  `${(prefix || DEFAULT_LOT_PREFIX).toUpperCase()}${yymmdd(isoDate)}${letters.toUpperCase()}`;

/** "TA260806KRM" -> "2026-08-06"; null when the code is malformed or the date is not real. */
export const lotCodeDate = (code: string): string | null => {
  const m = LOT_CODE_REGEX.exec(code.toUpperCase().replace(/\s+/g, ''));
  if (!m) return null;
  const yy = Number(m[2].slice(0, 2));
  const mm = Number(m[2].slice(2, 4));
  const dd = Number(m[2].slice(4, 6));
  const year = 2000 + yy;
  const date = new Date(Date.UTC(year, mm - 1, dd));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) return null;
  return date.toISOString().slice(0, 10);
};

export const isValidLotCode = (code: string): boolean => lotCodeDate(code) !== null;

// ── Reading a code out of OCR text ────────────────────────────────────────────

/** Letters OCR commonly returns instead of digits */
const DIGIT_FIX: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8' };

export interface LotCandidate { code: string; date: string; score: number; }

/**
 * Find lot codes in raw OCR text, ignoring dates, weights and other printing.
 * Each line is scanned for: 2 letters, 6 digits (OCR look-alikes such as O/0 are fixed),
 * optional extra digits, 2-6 letters. Best candidate first; codes whose prefix + letters match a
 * known product rank higher.
 */
export function extractLotCodes(text: string, known: { prefix?: string | null; letters?: string | null }[] = []): LotCandidate[] {
  const knownKeys = known
    .filter(k => k.prefix && k.letters)
    .map(k => `${k.prefix}|${k.letters}`.toUpperCase());
  const found = new Map<string, LotCandidate>();
  const re = /([A-Z]{2})\s?([0-9OQDILZSB]{6})\s?([0-9]*)\s?([A-Z]{2,6})\b/g;

  for (const line of text.toUpperCase().split(/\r?\n/)) {
    for (const m of line.matchAll(re)) {
      if ((m[2].match(/[0-9]/g) ?? []).length < 4) continue; // mostly letters: not a date
      const digits = m[2].replace(/[A-Z]/g, c => DIGIT_FIX[c] ?? c);
      const code = `${m[1]}${digits}${m[3]}${m[4]}`;
      const date = lotCodeDate(code);
      if (!date) continue;
      const year = Number(date.slice(0, 4));
      let score = 1;
      if (knownKeys.includes(`${m[1]}|${m[4]}`)) score += 2;
      if (year >= 2020 && year <= new Date().getFullYear() + 1) score += 1;
      const prev = found.get(code);
      if (!prev || prev.score < score) found.set(code, { code, date, score });
    }
  }
  return [...found.values()].sort((a, b) => b.score - a.score);
}
