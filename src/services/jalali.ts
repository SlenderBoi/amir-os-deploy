/**
 * Jalali (Persian solar) calendar helpers.
 *
 * The browser's ICU already knows the Persian calendar, so instead of re-implementing the leap-year
 * rules by hand (easy to get subtly wrong) we ask Intl for the single source of truth and build the
 * reverse direction on top of it. Everything works on ISO "YYYY-MM-DD" strings at UTC noon, so there
 * are no timezone/DST surprises.
 */
export interface JDate { y: number; m: number; d: number }

export const JMONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
/** Saturday-first, matching the Iranian week. */
export const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
export const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
export const HMONTHS = ['محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی', 'جمادی‌الاول', 'جمادی‌الثانی', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذی‌القعده', 'ذی‌الحجه'];

const DAY = 864e5;
const p2 = (n: number) => String(n).padStart(2, '0');
export const faDigits = (v: string | number) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
export const enDigits = (s: string) => s
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

const utcNoon = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d, 12); };
const isoOf = (ms: number) => { const x = new Date(ms); return `${x.getUTCFullYear()}-${p2(x.getUTCMonth() + 1)}-${p2(x.getUTCDate())}`; };

export const addDaysISO = (iso: string, n: number) => isoOf(utcNoon(iso) + n * DAY);
export const diffDays = (a: string, b: string) => Math.round((utcNoon(a) - utcNoon(b)) / DAY);
/** 0 = Saturday … 6 = Friday */
export const weekdayIndex = (iso: string) => (new Date(utcNoon(iso)).getUTCDay() + 1) % 7;
export const isFriday = (iso: string) => weekdayIndex(iso) === 6;

const personFmt = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const parts = (s: string) => s.split('/').map(x => parseInt(x, 10));

export function toJalali(iso: string): JDate {
  const [m, d, y] = parts(personFmt.format(utcNoon(iso)));
  return { y, m, d };
}

const nowruzCache = new Map<number, string>();
/** Gregorian date of 1 Farvardin of the given Jalali year. */
export function nowruz(y: number): string {
  const hit = nowruzCache.get(y);
  if (hit) return hit;
  for (let day = 18; day <= 23; day++) {
    const iso = `${y + 621}-03-${p2(day)}`;
    const j = toJalali(iso);
    if (j.y === y && j.m === 1 && j.d === 1) { nowruzCache.set(y, iso); return iso; }
  }
  throw new Error(`Nowruz not found for ${y}`);
}

export const isLeapJalali = (y: number) => diffDays(nowruz(y + 1), nowruz(y)) === 366;
export const monthLength = (y: number, m: number) => m <= 6 ? 31 : m <= 11 ? 30 : isLeapJalali(y) ? 30 : 29;
const monthOffset = (m: number) => m <= 7 ? (m - 1) * 31 : 6 * 31 + (m - 7) * 30;

export function fromJalali(y: number, m: number, d: number): string {
  return addDaysISO(nowruz(y), monthOffset(m) + d - 1);
}

/** Month navigation that wraps the year. */
export function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** Cells of a Saturday-first month grid; leading/trailing blanks are null. */
export function monthGrid(y: number, m: number): (string | null)[] {
  const first = fromJalali(y, m, 1);
  const cells: (string | null)[] = Array(weekdayIndex(first)).fill(null);
  for (let d = 1; d <= monthLength(y, m); d++) cells.push(addDaysISO(first, d - 1));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export const startOfWeek = (iso: string) => addDaysISO(iso, -weekdayIndex(iso));

/** "۹ مهر ۱۴۰۵" */
export function formatJalali(iso: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const { y, m, d } = toJalali(iso);
  const core = `${faDigits(d)} ${JMONTHS[m - 1]}${opts.year === false ? '' : ` ${faDigits(y)}`}`;
  return opts.weekday ? `${WEEKDAYS[weekdayIndex(iso)]} ${core}` : core;
}
/** "۱۴۰۵/۰۷/۰۹" */
export const formatJalaliNumeric = (iso: string) => { const { y, m, d } = toJalali(iso); return faDigits(`${y}/${p2(m)}/${p2(d)}`); };

/** Accepts "1405/7/9", "۱۴۰۵-۰۷-۰۹" … returns ISO or null if it isn't a real Jalali date. */
export function parseJalali(text: string): string | null {
  const m = enDigits(text).trim().match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1200 || y > 1700 || mo < 1 || mo > 12 || d < 1 || d > monthLength(y, mo)) return null;
  return fromJalali(y, mo, d);
}

const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
/** Umm al-Qura Hijri date. Iran follows moon sighting, so this can differ from the Iranian calendar by a day. */
export function toHijri(iso: string): JDate {
  const [m, d, y] = parts(hijriFmt.format(utcNoon(iso)));
  return { y, m, d };
}

export const monthTitle = (y: number, m: number) => `${JMONTHS[m - 1]} ${faDigits(y)}`;
/** Gregorian span of a Jalali month, e.g. "Sep 23 – Oct 22, 2026" */
export function gregorianSpan(y: number, m: number): string {
  const a = new Date(utcNoon(fromJalali(y, m, 1))), b = new Date(utcNoon(fromJalali(y, m, monthLength(y, m))));
  const f = (x: Date, withYear: boolean) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(x);
  return `${f(a, false)} – ${f(b, true)}`;
}

/** First and last day (ISO) of the Jalali month containing `iso`. */
export function jalaliMonthRange(iso: string): { from: string; to: string; y: number; m: number } {
  const { y, m } = toJalali(iso);
  return { from: fromJalali(y, m, 1), to: fromJalali(y, m, monthLength(y, m)), y, m };
}
