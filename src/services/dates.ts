/** Local-calendar date key (YYYY-MM-DD). Never use toISOString() for this: it returns the UTC date,
 *  which is "yesterday" in Iran between 00:00 and 03:30. */
export const localISO = (d: Date = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
