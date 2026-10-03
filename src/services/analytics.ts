import type { DB } from '../types';
import { addDaysISO, diffDays, faDigits, formatJalali, fromJalali, JMONTHS, jalaliMonthRange, shiftMonth, toJalali, weekdayIndex, WEEKDAYS } from './jalali';
import { localISO } from './dates';

/**
 * Everything on the analytics page is derived from data that already exists (time entries, learning logs,
 * completed tasks, transactions, habit entries). Nothing is stored or estimated by an AI.
 * Dates are local ISO days; "focus" = tracked task time + learning minutes.
 */
export type RangeKind = '7' | '30' | '90' | 'month';
export interface Range { from: string; to: string; days: number }

export const dayOf = (timestamp: string) => localISO(new Date(timestamp));
export const daysBetween = (r: { from: string; to: string }) => { const out: string[] = []; for (let d = r.from; d <= r.to; d = addDaysISO(d, 1)) out.push(d); return out; };

export function rangeFor(kind: RangeKind, today: string): Range {
  if (kind === 'month') { const from = jalaliMonthRange(today).from; return { from, to: today, days: diffDays(today, from) + 1 }; }
  const n = Number(kind);
  return { from: addDaysISO(today, -(n - 1)), to: today, days: n };
}
/** The period right before, of the same elapsed length (for "vs. previous"). */
export function previousRange(kind: RangeKind, r: Range): Range {
  if (kind === 'month') {
    const { y, m } = toJalali(r.from), p = shiftMonth(y, m, -1), from = fromJalali(p.y, p.m, 1);
    return { from, to: addDaysISO(from, r.days - 1), days: r.days };
  }
  return { from: addDaysISO(r.from, -r.days), to: addDaysISO(r.from, -1), days: r.days };
}

export interface DayStat { taskMin: number; learnMin: number; tasksDone: number; income: number; expense: number; habitsDone: number }
const empty = (): DayStat => ({ taskMin: 0, learnMin: 0, tasksDone: 0, income: 0, expense: 0, habitsDone: 0 });
export const isActive = (s?: DayStat) => !!s && (s.taskMin > 0 || s.learnMin > 0 || s.tasksDone > 0 || s.habitsDone > 0);

export function dayStats(db: DB): Map<string, DayStat> {
  const m = new Map<string, DayStat>();
  const at = (d: string) => { let s = m.get(d); if (!s) { s = empty(); m.set(d, s); } return s; };
  db.timeEntries.forEach(e => { at(e.date).taskMin += e.minutes; });
  db.learning.forEach(t => t.logs.forEach(l => { at(l.date).learnMin += l.minutes; }));
  db.tasks.forEach(t => { if (t.status === 'done' && t.completedAt) at(dayOf(t.completedAt)).tasksDone++; });
  db.transactions.forEach(x => { if (x.type === 'income') at(x.date).income += x.amount; else if (x.type === 'expense') at(x.date).expense += x.amount; });
  db.habits.forEach(h => Object.entries(h.entries).forEach(([d, v]) => { if (v >= h.target) at(d).habitsDone++; }));
  return m;
}

export interface Totals { tasksDone: number; taskMin: number; learnMin: number; focusMin: number; income: number; expense: number; activeDays: number; days: number; habitRate: number }
export function totals(stats: Map<string, DayStat>, r: Range, habitCount: number): Totals {
  const t: Totals = { tasksDone: 0, taskMin: 0, learnMin: 0, focusMin: 0, income: 0, expense: 0, activeDays: 0, days: r.days, habitRate: 0 };
  let habitsDone = 0;
  for (const d of daysBetween(r)) {
    const s = stats.get(d); if (!s) continue;
    t.tasksDone += s.tasksDone; t.taskMin += s.taskMin; t.learnMin += s.learnMin; t.income += s.income; t.expense += s.expense; habitsDone += s.habitsDone;
    if (isActive(s)) t.activeDays++;
  }
  t.focusMin = t.taskMin + t.learnMin;
  t.habitRate = habitCount ? Math.round(100 * habitsDone / (habitCount * r.days)) : 0;
  return t;
}

/** Percent change, or null when there is nothing to compare against. */
export const delta = (cur: number, prev: number): number | null => prev > 0 ? Math.round(100 * (cur - prev) / prev) : null;

export interface Bucket { label: string; title: string; values: number[] }
/** Daily focus bars; long ranges are grouped by week so bars stay readable. */
export function focusBuckets(stats: Map<string, DayStat>, r: Range): Bucket[] {
  const days = daysBetween(r), size = days.length > 45 ? 7 : 1, out: Bucket[] = [];
  for (let i = 0; i < days.length; i += size) {
    const chunk = days.slice(i, i + size);
    const task = chunk.reduce((a, d) => a + (stats.get(d)?.taskMin ?? 0), 0), learn = chunk.reduce((a, d) => a + (stats.get(d)?.learnMin ?? 0), 0);
    const first = chunk[0], j = toJalali(first);
    out.push({ label: size === 1 ? faDigits(j.d) : `${faDigits(j.d)} ${JMONTHS[j.m - 1]}`, title: size === 1 ? formatJalali(first, { weekday: true }) : `هفتهٔ ${formatJalali(first, { year: false })}`, values: [task, learn] });
  }
  return out;
}

/** Average focus minutes for each weekday (Saturday-first) inside the range. */
export function weekdayAverages(stats: Map<string, DayStat>, r: Range): { label: string; avg: number; days: number }[] {
  const sum = Array(7).fill(0), cnt = Array(7).fill(0);
  for (const d of daysBetween(r)) { const w = weekdayIndex(d); cnt[w]++; const s = stats.get(d); sum[w] += s ? s.taskMin + s.learnMin : 0; }
  return WEEKDAYS.map((label, i) => ({ label, avg: cnt[i] ? Math.round(sum[i] / cnt[i]) : 0, days: cnt[i] }));
}

export function learningByTrack(db: DB, r: Range): { id: string; title: string; color: string; minutes: number }[] {
  return db.learning.map(t => ({ id: t.id, title: t.title, color: t.color, minutes: t.logs.filter(l => l.date >= r.from && l.date <= r.to).reduce((a, l) => a + l.minutes, 0) }))
    .filter(x => x.minutes > 0).sort((a, b) => b.minutes - a.minutes);
}

export function categorySpend(db: DB, r: Range, top = 6): { category: string; amount: number; share: number }[] {
  const by = new Map<string, number>();
  db.transactions.filter(x => x.type === 'expense' && x.date >= r.from && x.date <= r.to).forEach(x => by.set(x.category || 'عمومی', (by.get(x.category || 'عمومی') ?? 0) + x.amount));
  const all = [...by].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const total = all.reduce((a, x) => a + x.amount, 0);
  const head = all.slice(0, top), rest = all.slice(top).reduce((a, x) => a + x.amount, 0);
  if (rest > 0) head.push({ category: 'سایر', amount: rest });
  return head.map(x => ({ ...x, share: total ? Math.round(100 * x.amount / total) : 0 }));
}

/** Income vs expense for the last `n` Jalali months, oldest first (the current month is partial). */
export function monthlyFinance(db: DB, today: string, n = 6): { label: string; income: number; expense: number }[] {
  const { y, m } = toJalali(today);
  return Array.from({ length: n }, (_, i) => {
    const p = shiftMonth(y, m, i - (n - 1)), from = fromJalali(p.y, p.m, 1), to = shiftMonth(p.y, p.m, 1);
    const end = addDaysISO(fromJalali(to.y, to.m, 1), -1);
    const tx = db.transactions.filter(x => x.date >= from && x.date <= end);
    return { label: JMONTHS[p.m - 1], income: tx.filter(x => x.type === 'income').reduce((a, x) => a + x.amount, 0), expense: tx.filter(x => x.type === 'expense').reduce((a, x) => a + x.amount, 0) };
  });
}

export interface HabitRow { id: string; title: string; done: number; days: number; rate: number; streak: number }
export function habitBreakdown(db: DB, r: Range, today: string): HabitRow[] {
  const days = daysBetween(r);
  return db.habits.map(h => {
    const done = days.filter(d => (h.entries[d] ?? 0) >= h.target).length;
    let streak = 0, d = (h.entries[today] ?? 0) >= h.target ? today : addDaysISO(today, -1);
    while ((h.entries[d] ?? 0) >= h.target) { streak++; d = addDaysISO(d, -1); }
    return { id: h.id, title: h.title, done, days: days.length, rate: Math.round(100 * done / days.length), streak };
  }).sort((a, b) => b.rate - a.rate);
}

/** How good your time estimates are: actual ÷ estimate over finished tasks that have both. */
export function estimateAccuracy(db: DB): { n: number; ratio: number } | null {
  const t = db.tasks.filter(x => x.status === 'done' && x.estimate > 0 && x.actual > 0);
  if (!t.length) return null;
  return { n: t.length, ratio: t.reduce((a, x) => a + x.actual, 0) / t.reduce((a, x) => a + x.estimate, 0) };
}

export function activeStreaks(stats: Map<string, DayStat>, today: string): { current: number; longest: number } {
  let current = 0, d = isActive(stats.get(today)) ? today : addDaysISO(today, -1);
  while (isActive(stats.get(d))) { current++; d = addDaysISO(d, -1); }
  const dates = [...stats].filter(([, s]) => isActive(s)).map(([k]) => k).sort();
  let longest = 0, run = 0, prev = '';
  for (const k of dates) { run = prev && diffDays(k, prev) === 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = k; }
  return { current, longest };
}

export interface Insight { tone: 'good' | 'warn' | 'info'; text: string }
const hours = (min: number) => faDigits((min / 60).toFixed(1).replace(/\.0$/, '').replace('.', '٫'));
const pct = (n: number) => faDigits(Math.abs(n));

/** Plain rule-based observations. Each rule needs enough data to say something real, otherwise it stays silent. */
export function insights(db: DB, kind: RangeKind, r: Range, today: string): Insight[] {
  const stats = dayStats(db), cur = totals(stats, r, db.habits.length), prev = totals(stats, previousRange(kind, r), db.habits.length);
  const out: Insight[] = [];

  const wd = weekdayAverages(stats, r), best = [...wd].sort((a, b) => b.avg - a.avg)[0];
  if (cur.activeDays >= 5 && best.avg > 0) out.push({ tone: 'info', text: `پربازده‌ترین روز هفته‌ات «${best.label}» است؛ میانگین ${hours(best.avg)} ساعت تمرکز.` });

  const st = activeStreaks(stats, today);
  if (st.current >= 2) out.push({ tone: 'good', text: `${faDigits(st.current)} روز پشت‌سرهم فعال بوده‌ای${st.longest > st.current ? ` (رکوردت ${faDigits(st.longest)} روز)` : ' — این رکورد توست!'}` });

  const est = estimateAccuracy(db);
  if (est && est.n >= 3) {
    if (est.ratio > 1.25) out.push({ tone: 'warn', text: `کارها معمولاً ${pct(Math.round((est.ratio - 1) * 100))}٪ بیشتر از تخمینت طول می‌کشند (از ${faDigits(est.n)} کار). دفعهٔ بعد تخمین را بیشتر بگیر.` });
    else if (est.ratio < 0.8) out.push({ tone: 'good', text: `معمولاً ${pct(Math.round((1 - est.ratio) * 100))}٪ زودتر از تخمینت تمام می‌کنی؛ می‌توانی برنامه را فشرده‌تر ببندی.` });
    else out.push({ tone: 'good', text: `تخمین‌های زمانی‌ات دقیق‌اند (اختلاف کمتر از ۲۵٪، از ${faDigits(est.n)} کار).` });
  }

  const d = delta(cur.learnMin, prev.learnMin);
  if (d !== null && Math.abs(d) >= 15) out.push({ tone: d > 0 ? 'good' : 'warn', text: `زمان یادگیری‌ات ${pct(d)}٪ ${d > 0 ? 'بیشتر' : 'کمتر'} از دورهٔ قبل بوده.` });
  const dt = delta(cur.tasksDone, prev.tasksDone);
  if (dt !== null && prev.tasksDone >= 3 && Math.abs(dt) >= 25) out.push({ tone: dt > 0 ? 'good' : 'warn', text: `کارهای انجام‌شده ${pct(dt)}٪ ${dt > 0 ? 'بیشتر' : 'کمتر'} از دورهٔ قبل است.` });

  const cats = categorySpend(db, r);
  if (cats[0] && cats[0].category !== 'سایر' && cats[0].share >= 40 && cur.expense > 0) out.push({ tone: 'info', text: `${pct(cats[0].share)}٪ خرجت در این بازه «${cats[0].category}» بوده.` });
  if (cur.income > 0 && cur.expense > cur.income) out.push({ tone: 'warn', text: 'خرجت در این بازه از درآمدت بیشتر شده.' });

  const weak = habitBreakdown(db, r, today).filter(h => h.days >= 7 && h.rate < 50).sort((a, b) => a.rate - b.rate)[0];
  if (weak) out.push({ tone: 'warn', text: `عادت «${weak.title}» فقط ${pct(weak.rate)}٪ روزها انجام شده.` });

  // sleep ↔ focus: needs a real sample on both sides before claiming anything
  const slept = db.health.filter(h => h.date >= r.from && h.date <= r.to);
  const focusOn = (h: { date: string }) => { const s = stats.get(h.date); return s ? s.taskMin + s.learnMin : 0; };
  const good = slept.filter(h => h.sleep >= 7), poor = slept.filter(h => h.sleep < 7);
  if (good.length >= 4 && poor.length >= 4) {
    const g = good.reduce((a, h) => a + focusOn(h), 0) / good.length, p = poor.reduce((a, h) => a + focusOn(h), 0) / poor.length;
    if (g > 0 && p >= 0 && Math.abs(g - p) / Math.max(g, p) >= 0.25) out.push({ tone: 'info', text: `روزهایی که ۷ ساعت یا بیشتر خوابیده‌ای ${hours(g)} ساعت تمرکز داشته‌ای، در بقیهٔ روزها ${hours(p)} ساعت.` });
  }

  const overdue = db.tasks.filter(t => t.due && t.due < today && t.status !== 'done' && t.status !== 'archived').length;
  if (overdue > 0) out.push({ tone: 'warn', text: `${faDigits(overdue)} کار عقب‌افتاده داری.` });
  return out;
}
