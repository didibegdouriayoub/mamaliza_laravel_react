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
