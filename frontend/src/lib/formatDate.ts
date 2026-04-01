/**
 * Format an ISO date string as DD-MM-YYYY HH:mm
 * Returns '—' for empty/invalid input.
 */
export const formatDate = (str: string | null | undefined): string => {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()} ${hh}:${min}`;
};
