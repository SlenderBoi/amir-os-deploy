import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import type { DB, Task } from '../types';
import { activeStreaks, categorySpend, dayStats, delta, estimateAccuracy, focusBuckets, habitBreakdown, insights, monthlyFinance, previousRange, rangeFor, totals, weekdayAverages } from './analytics';
import { buildTimeline, groupByDay } from './timeline';

const TODAY = '2026-10-01'; // Thursday, 9 Mehr 1405
const blank = (): DB => ({ ...structuredClone(seed), tasks: [], events: [], habits: [], learning: [], wishes: [], notes: [], health: [], transactions: [], timeEntries: [], reviews: {}, timer: null });
const task = (o: Partial<Task>): Task => ({ id: 't', title: 'کار', description: '', status: 'todo', priority: 'medium', estimate: 30, actual: 0, tags: [], subtasks: [], notes: '', createdAt: '2026-09-01T08:00:00', updatedAt: '', ...o });
const entry = (id: string, date: string, minutes: number) => ({ id, taskId: 't', date, minutes, createdAt: `${date}T10:00:00` });
const log = (id: string, date: string, minutes: number) => ({ id, date, minutes, topic: 'x', notes: '', keyPoints: [], ideas: [], createdAt: `${date}T20:00:00` });
const track = (logs: ReturnType<typeof log>[]) => ({ id: 'py', title: 'پایتون', description: '', color: '#0f0', status: 'active' as const, goalHours: 10, tags: [], resources: [], logs, createdAt: '' });

describe('ranges', () => {
  it('N-day range ends today and the previous one is the same length right before', () => {
    const r = rangeFor('7', TODAY), p = previousRange('7', r);
    expect(r).toEqual({ from: '2026-09-25', to: TODAY, days: 7 });
    expect(p).toEqual({ from: '2026-09-18', to: '2026-09-24', days: 7 });
  });
  it('"this month" is the Jalali month so far, compared with the same number of days of the previous Jalali month', () => {
    const r = rangeFor('month', TODAY), p = previousRange('month', r);
    expect(r).toEqual({ from: '2026-09-23', to: TODAY, days: 9 });   // 1–9 Mehr
    expect(p).toEqual({ from: '2026-08-23', to: '2026-08-31', days: 9 }); // 1–9 Shahrivar
  });
});

describe('totals', () => {
  const db = blank();
  db.timeEntries = [entry('a', '2026-10-01', 60), entry('b', '2026-09-30', 30), entry('old', '2026-08-01', 500)];
  db.learning = [track([log('l1', '2026-10-01', 45), log('l2', '2026-09-26', 15)])];
  db.tasks = [task({ id: '1', status: 'done', completedAt: '2026-10-01T12:00:00' }), task({ id: '2', status: 'done', completedAt: '2026-09-20T12:00:00' }), task({ id: '3' })];
  db.transactions = [
    { id: 'i', title: '', amount: 1000, type: 'income', date: '2026-10-01', category: 'x', notes: '', recurring: false, paid: true, createdAt: '' },
    { id: 'e', title: '', amount: 400, type: 'expense', date: '2026-10-01', category: 'خوراک', notes: '', recurring: false, paid: true, createdAt: '' },
    { id: 'd', title: '', amount: 9999, type: 'debt', date: '2026-10-01', category: 'x', notes: '', recurring: false, paid: false, createdAt: '' },
  ];
  db.habits = [{ id: 'h', title: 'ورزش', target: 1, unit: '', color: '', entries: { '2026-10-01': 1, '2026-09-30': 1, '2026-09-29': 0 } }];
  const stats = dayStats(db);

  it('sums only what is inside the range; debts are not income or expense', () => {
    const t = totals(stats, rangeFor('7', TODAY), db.habits.length);
    expect(t.taskMin).toBe(90); expect(t.learnMin).toBe(60); expect(t.focusMin).toBe(150);
    expect(t.tasksDone).toBe(1); expect(t.income).toBe(1000); expect(t.expense).toBe(400);
    expect(t.activeDays).toBe(3);              // 1 Oct, 30 Sep (timer + habit), 26 Sep (learning)
    expect(t.habitRate).toBe(Math.round(100 * 2 / 7));
  });
  it('delta handles "nothing to compare" without dividing by zero', () => {
    expect(delta(10, 0)).toBeNull(); expect(delta(15, 10)).toBe(50); expect(delta(5, 10)).toBe(-50);
  });
  it('week buckets kick in for long ranges, daily otherwise', () => {
    expect(focusBuckets(stats, rangeFor('30', TODAY))).toHaveLength(30);
    expect(focusBuckets(stats, rangeFor('90', TODAY)).length).toBeLessThan(15);
    const b = focusBuckets(stats, rangeFor('7', TODAY));
    expect(b[6].values).toEqual([60, 45]);
  });
  it('weekday averages are Saturday-first and divide by how many such days the range has', () => {
    const w = weekdayAverages(stats, rangeFor('7', TODAY));
    expect(w[5].label).toBe('پنجشنبه'); expect(w[5].avg).toBe(105);   // 60 + 45 on Thu 1 Oct
    expect(w[0].label).toBe('شنبه'); expect(w[0].days).toBe(1);
  });
  it('category spend ranks by amount and rolls the tail into "سایر"', () => {
    const d = blank();
    d.transactions = Array.from({ length: 8 }, (_, i) => ({ id: String(i), title: '', amount: 100 * (i + 1), type: 'expense' as const, date: TODAY, category: `c${i}`, notes: '', recurring: false, paid: true, createdAt: '' }));
    const c = categorySpend(d, rangeFor('7', TODAY));
    expect(c[0].category).toBe('c7'); expect(c).toHaveLength(7); expect(c[6].category).toBe('سایر');
    expect(c.reduce((a, x) => a + x.share, 0)).toBeGreaterThanOrEqual(98);
  });
  it('monthly finance buckets by Jalali month (last one is the current, partial month)', () => {
    const m = monthlyFinance(db, TODAY, 3);
    expect(m.map(x => x.label)).toEqual(['مرداد', 'شهریور', 'مهر']);
    expect(m[2]).toMatchObject({ income: 1000, expense: 400 });
  });
  it('habit rate and current streak (a not-yet-done today does not break the streak)', () => {
    const h = habitBreakdown(db, rangeFor('7', TODAY), TODAY)[0];
    expect(h.done).toBe(2); expect(h.streak).toBe(2);
    const d2 = structuredClone(db); d2.habits[0].entries = { '2026-09-30': 1, '2026-09-29': 1 };
    expect(habitBreakdown(d2, rangeFor('7', TODAY), TODAY)[0].streak).toBe(2);
  });
});

describe('streaks and estimates', () => {
  it('current and longest active streak', () => {
    const db = blank();
    db.timeEntries = ['2026-10-01', '2026-09-30', '2026-09-29', '2026-09-20', '2026-09-19', '2026-09-18', '2026-09-17'].map((d, i) => entry(String(i), d, 10));
    expect(activeStreaks(dayStats(db), TODAY)).toEqual({ current: 3, longest: 4 });
  });
  it('estimate accuracy ignores tasks without both numbers', () => {
    const db = blank();
    db.tasks = [task({ id: 'a', status: 'done', estimate: 60, actual: 90 }), task({ id: 'b', status: 'done', estimate: 60, actual: 0 }), task({ id: 'c', status: 'todo', estimate: 60, actual: 120 })];
    expect(estimateAccuracy(db)).toEqual({ n: 1, ratio: 1.5 });
    expect(estimateAccuracy(blank())).toBeNull();
  });
});

describe('insights stay silent without data and never invent numbers', () => {
  it('empty database → no observations', () => {
    expect(insights(blank(), '30', rangeFor('30', TODAY), TODAY)).toEqual([]);
  });
  it('flags slow estimates, overdue tasks and habits that are slipping', () => {
    const db = blank();
    db.tasks = [1, 2, 3].map(i => task({ id: `d${i}`, status: 'done', estimate: 30, actual: 60, completedAt: '2026-09-28T10:00:00' })).concat([task({ id: 'o', due: '2026-09-20' })]);
    db.habits = [{ id: 'h', title: 'مطالعه', target: 1, unit: '', color: '', entries: { '2026-09-30': 1 } }];
    const text = insights(db, '30', rangeFor('30', TODAY), TODAY).map(i => i.text).join('\n');
    expect(text).toContain('۱۰۰٪ بیشتر از تخمینت');
    expect(text).toContain('۱ کار عقب‌افتاده');
    expect(text).toContain('عادت «مطالعه» فقط ۳٪');
  });
  it('sleep/focus claim needs ≥4 days on both sides', () => {
    const db = blank();
    const health = (d: string, sleep: number) => ({ id: d, date: d, sleep, energy: 3, mood: 3, water: 0, meals: 3, exercise: 0, notes: '' });
    db.health = ['2026-09-20', '2026-09-21', '2026-09-22'].map(d => health(d, 8)).concat(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'].map(d => health(d, 5)));
    expect(insights(db, '30', rangeFor('30', TODAY), TODAY).some(i => i.text.includes('خوابیده'))).toBe(false);
  });
});

describe('timeline', () => {
  const db = blank();
  db.tasks = [task({ id: 'x', title: 'طراحی', createdAt: '2026-09-30T09:00:00', status: 'done', completedAt: '2026-10-01T11:00:00', actual: 45 })];
  db.timeEntries = [entry('te', '2026-10-01', 25)];
  db.learning = [track([{ ...log('l', '2026-09-28', 30), createdAt: '2026-10-01T09:00:00' }])];   // back-dated log
  db.habits = [{ id: 'h', title: 'a', target: 1, unit: '', color: '', entries: { '2026-10-01': 1 } }];
  db.events = [{ id: 'future', title: 'آینده', date: '2026-10-05', start: '09:00', end: '10:00', kind: 'work', createdAt: '' }];
  const tl = buildTimeline(db, TODAY);

  it('is newest-first, skips the future, and links entries to a page', () => {
    expect(tl.map(i => i.day)).toEqual([...tl.map(i => i.day)].sort().reverse());
    expect(tl.some(i => i.title.includes('آینده'))).toBe(false);
    expect(tl.find(i => i.id === 'td-x')!.page).toBe('tasks');
  });
  it('a back-dated learning log appears on the day you chose, without a fake clock time', () => {
    const l = tl.find(i => i.id === 'll-l')!;
    expect(l.day).toBe('2026-09-28'); expect(l.hasTime).toBe(false);
  });
  it('real timestamps keep their time of day; groups are per day', () => {
    expect(tl.find(i => i.id === 'td-x')!.hasTime).toBe(true);
    const g = groupByDay(tl);
    expect(g[0].day).toBe('2026-10-01');
    expect(new Set(g.map(x => x.day)).size).toBe(g.length);
  });
});
