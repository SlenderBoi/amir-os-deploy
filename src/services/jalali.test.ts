import { describe, expect, it } from 'vitest';
import { addDaysISO, formatJalali, fromJalali, isLeapJalali, monthGrid, monthLength, nowruz, parseJalali, shiftMonth, toJalali, weekdayIndex } from './jalali';
import { eventsOn, eventsOfYear, fixKey, isHoliday, nextHolidays } from './holidays';

describe('jalali', () => {
  it('knows today in the Jalali calendar', () => {
    expect(toJalali('2026-10-01')).toEqual({ y: 1405, m: 7, d: 9 });
    expect(toJalali('2026-03-21')).toEqual({ y: 1405, m: 1, d: 1 });
  });
  it('round-trips every day from 1380 to 1430', () => {
    for (let y = 1380; y <= 1430; y++) for (let m = 1; m <= 12; m++) {
      const last = monthLength(y, m);
      for (const d of [1, 15, last]) expect(toJalali(fromJalali(y, m, d))).toEqual({ y, m, d });
    }
  });
  it('has correct leap years and month lengths', () => {
    expect([1399, 1403, 1408, 1412].every(isLeapJalali)).toBe(true);
    expect([1400, 1401, 1402, 1404, 1405, 1406].some(isLeapJalali)).toBe(false);
    expect(monthLength(1403, 12)).toBe(30); expect(monthLength(1404, 12)).toBe(29);
    expect(monthLength(1405, 6)).toBe(31); expect(monthLength(1405, 7)).toBe(30);
  });
  it('Nowruz lands on the right Gregorian day', () => {
    expect(nowruz(1403)).toBe('2024-03-20'); expect(nowruz(1404)).toBe('2025-03-21'); expect(nowruz(1405)).toBe('2026-03-21');
  });
  it('week is Saturday-first, Friday is 6', () => {
    expect(weekdayIndex('2026-10-03')).toBe(0); // Saturday
    expect(weekdayIndex('2026-10-02')).toBe(6); // Friday
    expect(formatJalali('2026-10-01', { weekday: true })).toBe('پنجشنبه ۹ مهر ۱۴۰۵');
  });
  it('month grid is aligned to weeks and complete', () => {
    const g = monthGrid(1405, 7);
    expect(g.length % 7).toBe(0);
    expect(g.filter(Boolean)).toHaveLength(30);
    expect(g.indexOf('2026-09-23')).toBe(weekdayIndex('2026-09-23'));
  });
  it('shifts months across year boundaries', () => {
    expect(shiftMonth(1405, 12, 1)).toEqual({ y: 1406, m: 1 });
    expect(shiftMonth(1405, 1, -1)).toEqual({ y: 1404, m: 12 });
  });
  it('parses typed dates in either digit set and rejects impossible ones', () => {
    expect(parseJalali('۱۴۰۵/۷/۹')).toBe('2026-10-01');
    expect(parseJalali('1405-07-09')).toBe('2026-10-01');
    expect(parseJalali('1405/7/31')).toBeNull();
    expect(parseJalali('1404/12/30')).toBeNull();
    expect(parseJalali('1403/12/30')).toBe('2025-03-20');
    expect(parseJalali('hello')).toBeNull();
  });
});

describe('holidays', () => {
  it('fixed solar holidays are exact', () => {
    expect(isHoliday('2026-03-21')).toBe(true);   // 1 Farvardin
    expect(isHoliday('2027-02-11')).toBe(true);   // 22 Bahman 1405
    expect(isHoliday('2026-10-01')).toBe(false);
  });
  it('lunar holidays are present and flagged approximate', () => {
    const ev = eventsOfYear(1405);
    const ashura = ev.find(e => e.id === 'ashura')!;
    expect(ashura.lunar).toBe(true);
    expect(ashura.iso).toBe('2026-06-25');          // 4 Tir 1405
    expect(ev.find(e => e.id === 'qurban')!.iso).toBe('2026-05-27'); // 6 Khordad
  });
  it('every year has a sane number of lunar holidays', () => {
    for (const y of [1404, 1405, 1406, 1407]) {
      const ids = eventsOfYear(y).filter(e => e.lunar).map(e => e.id);
      expect(ids.length).toBeGreaterThanOrEqual(17);
      expect(ids.length).toBeLessThanOrEqual(22);   // a lunar occasion can fall twice in one solar year, never three times
      for (const id of new Set(ids)) expect(ids.filter(x => x === id).length).toBeLessThanOrEqual(2);
    }
  });
  it('Eid al-Fitr falls twice in 1405 (day two on 1 Farvardin, then again in Esfand) and each can be corrected independently', () => {
    const fitr = eventsOfYear(1405).filter(e => e.id === 'fitr2');
    expect(fitr.map(e => e.iso)).toEqual(['2026-03-21', '2027-03-10']);
    const moved = eventsOfYear(1405, { [fixKey(fitr[1])]: -1 }).filter(e => e.id === 'fitr2');
    expect(moved.map(e => e.iso)).toEqual(['2026-03-21', '2027-03-09']);
    expect(eventsOfYear(1405).find(e => e.id === 'fitr1')!.iso).toBe('2027-03-09'); // Umm al-Qura says 18 Esfand; the Iranian calendar usually lands a day later
  });
  it('user correction moves a holiday by ±1 day, only for that year', () => {
    const base = eventsOfYear(1405).find(e => e.id === 'arbaeen')!;
    const fix = { [fixKey(base)]: 1 };
    const moved = eventsOfYear(1405, fix).find(e => e.id === 'arbaeen')!;
    expect(moved.iso).toBe(addDaysISO(base.iso, 1));
    expect(eventsOn(moved.iso, fix).some(e => e.id === 'arbaeen')).toBe(true);
    expect(eventsOn(base.iso, fix).some(e => e.id === 'arbaeen')).toBe(false);
    expect(eventsOfYear(1406, fix).find(e => e.id === 'arbaeen')!.iso).toBe(eventsOfYear(1406).find(e => e.id === 'arbaeen')!.iso);
  });
  it('next holidays are sorted, in the future and collapse Nowruz into one entry', () => {
    const n = nextHolidays('2026-10-01', 5);
    expect(n.length).toBe(5);
    expect(n.every(e => e.iso >= '2026-10-01')).toBe(true);
    expect([...n].sort((a, b) => a.iso.localeCompare(b.iso))).toEqual(n);
    const spring = nextHolidays('2027-03-01', 6).filter(e => e.title.includes('نوروز'));
    expect(spring.length).toBeLessThanOrEqual(2);
  });
});
