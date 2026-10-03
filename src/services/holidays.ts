import { addDaysISO, diffDays, fromJalali, nowruz, toHijri, toJalali, faDigits } from './jalali';

/**
 * Iranian official holidays + a few well-known occasions.
 *  - Solar holidays have fixed Jalali dates, so they are exact for every year.
 *  - Religious (lunar) holidays are computed from the Umm al-Qura Hijri calendar. Iran decides month
 *    starts by moon sighting, so any of them can be off by ±1 day: they are flagged `approx` and the
 *    user can nudge each one per year (stored in settings.holidayFix) to match the official calendar.
 */
export interface DayEvent { id: string; title: string; off: boolean; lunar: boolean }
export interface DatedEvent extends DayEvent { iso: string; baseIso: string }

const SOLAR: { m: number; d: number; title: string; off: boolean }[] = [
  { m: 1, d: 1, title: 'جشن نوروز', off: true }, { m: 1, d: 2, title: 'عید نوروز', off: true },
  { m: 1, d: 3, title: 'عید نوروز', off: true }, { m: 1, d: 4, title: 'عید نوروز', off: true },
  { m: 1, d: 12, title: 'روز جمهوری اسلامی', off: true }, { m: 1, d: 13, title: 'سیزده‌بدر', off: true },
  { m: 3, d: 14, title: 'رحلت امام خمینی', off: true }, { m: 3, d: 15, title: 'قیام ۱۵ خرداد', off: true },
  { m: 11, d: 22, title: 'پیروزی انقلاب اسلامی', off: true }, { m: 12, d: 29, title: 'ملی شدن صنعت نفت', off: true },
  { m: 2, d: 11, title: 'روز جهانی کارگر', off: false }, { m: 2, d: 12, title: 'روز معلم', off: false },
  { m: 8, d: 13, title: 'روز دانش‌آموز', off: false }, { m: 9, d: 16, title: 'روز دانشجو', off: false },
  { m: 9, d: 30, title: 'شب یلدا', off: false },
];

/** hd: day of Hijri month, or 'last' for the last day of that month. */
const LUNAR: { id: string; hm: number; hd: number | 'last'; title: string; off: boolean }[] = [
  { id: 'tasua', hm: 1, hd: 9, title: 'تاسوعای حسینی', off: true },
  { id: 'ashura', hm: 1, hd: 10, title: 'عاشورای حسینی', off: true },
  { id: 'arbaeen', hm: 2, hd: 20, title: 'اربعین حسینی', off: true },
  { id: 'rahlat', hm: 2, hd: 28, title: 'رحلت پیامبر (ص) و شهادت امام حسن (ع)', off: true },
  { id: 'reza', hm: 2, hd: 'last', title: 'شهادت امام رضا (ع)', off: true },
  { id: 'askari', hm: 3, hd: 8, title: 'شهادت امام حسن عسکری (ع)', off: true },
  { id: 'milad', hm: 3, hd: 17, title: 'میلاد پیامبر (ص) و امام صادق (ع)', off: true },
  { id: 'zahra', hm: 6, hd: 3, title: 'شهادت حضرت فاطمه (س)', off: true },
  { id: 'mother', hm: 6, hd: 20, title: 'ولادت حضرت فاطمه (س) · روز مادر', off: false },
  { id: 'ali-birth', hm: 7, hd: 13, title: 'ولادت امام علی (ع) · روز پدر', off: true },
  { id: 'mabath', hm: 7, hd: 27, title: 'مبعث پیامبر (ص)', off: true },
  { id: 'shaban15', hm: 8, hd: 15, title: 'نیمه شعبان · ولادت امام زمان (عج)', off: true },
  { id: 'ali-martyr', hm: 9, hd: 21, title: 'شهادت امام علی (ع)', off: true },
  { id: 'fitr1', hm: 10, hd: 1, title: 'عید سعید فطر', off: true },
  { id: 'fitr2', hm: 10, hd: 2, title: 'تعطیل به مناسبت عید فطر', off: true },
  { id: 'sadiq', hm: 10, hd: 25, title: 'شهادت امام جعفر صادق (ع)', off: true },
  { id: 'qurban', hm: 12, hd: 10, title: 'عید سعید قربان', off: true },
  { id: 'ghadir', hm: 12, hd: 18, title: 'عید سعید غدیر خم', off: true },
];

const baseCache = new Map<number, DatedEvent[]>();
function baseOfYear(jy: number): DatedEvent[] {
  const hit = baseCache.get(jy);
  if (hit) return hit;
  const out: DatedEvent[] = [];
  for (const s of SOLAR) {
    const iso = fromJalali(jy, s.m, s.d);
    out.push({ id: `s${s.m}-${s.d}`, title: s.title, off: s.off, lunar: false, iso, baseIso: iso });
  }
  const start = nowruz(jy), end = nowruz(jy + 1);
  for (let iso = start; iso < end; iso = addDaysISO(iso, 1)) {
    const h = toHijri(iso);
    for (const l of LUNAR) {
      if (l.hm !== h.m) continue;
      const hit = l.hd === 'last' ? toHijri(addDaysISO(iso, 1)).d === 1 : l.hd === h.d;
      if (hit) out.push({ id: l.id, title: l.title, off: l.off, lunar: true, iso, baseIso: iso });
    }
  }
  baseCache.set(jy, out);
  return out;
}

export type HolidayFix = Record<string, number>;
/** Keyed by the computed date, because a lunar occasion can fall twice in one solar year (Eid al-Fitr in 1405). */
export const fixKey = (e: Pick<DatedEvent, 'id' | 'baseIso'>) => `${e.id}@${e.baseIso}`;

/** All events of a Jalali year with the user's ±day corrections applied. */
export function eventsOfYear(jy: number, fix: HolidayFix = {}): DatedEvent[] {
  return baseOfYear(jy).map(e => {
    const shift = e.lunar ? fix[fixKey(e)] ?? 0 : 0;
    return shift ? { ...e, iso: addDaysISO(e.baseIso, shift) } : e;
  });
}

/** Events landing on one date. A lunar holiday near a year boundary is looked up in both neighbouring years. */
export function eventsOn(iso: string, fix: HolidayFix = {}): DatedEvent[] {
  const jy = toJalali(iso).y;
  return [jy - 1, jy, jy + 1].flatMap(y => (y === jy ? eventsOfYear(y, fix) : eventsOfYear(y, fix).filter(e => e.lunar))).filter(e => e.iso === iso);
}

/** Whether the date is an official day off by holiday (Fridays are handled separately). */
export const isHoliday = (iso: string, fix: HolidayFix = {}) => eventsOn(iso, fix).some(e => e.off);

export function nextHolidays(fromIso: string, count: number, fix: HolidayFix = {}): DatedEvent[] {
  const jy = toJalali(fromIso).y;
  return [jy, jy + 1].flatMap(y => eventsOfYear(y, fix))
    .filter(e => e.off && e.iso >= fromIso)
    .sort((a, b) => a.iso.localeCompare(b.iso))
    // consecutive days with the same title (Nowruz) read better as one entry
    .filter((e, i, all) => !(i > 0 && all[i - 1].title === e.title))
    .slice(0, count);
}

export const describeFix = (e: DatedEvent) => {
  const shift = diffDays(e.iso, e.baseIso);
  return shift ? `${faDigits(Math.abs(shift))} روز ${shift > 0 ? 'جلو' : 'عقب'} رفته` : '';
};
