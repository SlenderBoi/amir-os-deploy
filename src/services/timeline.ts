import type { DB } from '../types';
import { dayOf } from './analytics';
import { faNum } from '../ui';
import { snippet } from './journal';

/**
 * Activity timeline, rebuilt from the data on every render (nothing extra is stored).
 * Honest limit: it can only show things that still exist, so deleted items and past edits don't appear.
 */
export type TimelineKind = 'task' | 'focus' | 'learning' | 'money' | 'idea' | 'wish' | 'daily';
export interface TimelineItem {
  id: string; day: string; ts: number; kind: TimelineKind; icon: string;
  title: string; detail?: string; page: 'tasks' | 'journal' | 'automation' | 'learning' | 'finance' | 'notes' | 'wishlist' | 'health' | 'calendar'; hasTime: boolean;
}

export const KIND_LABEL: Record<TimelineKind, string> = { task: 'کار', focus: 'تمرکز', learning: 'یادگیری', money: 'مالی', idea: 'ایده', wish: 'ویش‌لیست', daily: 'روزانه' };

const stamp = (createdAt: string | undefined, day: string): { ts: number; hasTime: boolean } => {
  // entries that were back-dated keep their chosen day; otherwise the real creation time is used
  if (createdAt && !Number.isNaN(Date.parse(createdAt)) && dayOf(createdAt) === day) return { ts: Date.parse(createdAt), hasTime: true };
  return { ts: new Date(`${day}T12:00:00`).getTime(), hasTime: false };
};
const min = (m: number) => `${faNum(m)} دقیقه`;

export function buildTimeline(db: DB, today: string): TimelineItem[] {
  const items: TimelineItem[] = [];
  const add = (i: Omit<TimelineItem, 'ts' | 'hasTime'> & { createdAt?: string }) => {
    if (i.day > today) return;
    const { createdAt, ...rest } = i;
    items.push({ ...rest, ...stamp(createdAt, i.day) });
  };
  const taskTitle = new Map(db.tasks.map(t => [t.id, t.title]));

  for (const t of db.tasks) {
    add({ id: `tn-${t.id}`, day: dayOf(t.createdAt), createdAt: t.createdAt, kind: 'task', icon: '＋', title: `کار جدید: ${t.title}`, page: 'tasks' });
    if (t.status === 'done' && t.completedAt) add({ id: `td-${t.id}`, day: dayOf(t.completedAt), createdAt: t.completedAt, kind: 'task', icon: '✓', title: `انجام شد: ${t.title}`, detail: t.actual ? `زمان ثبت‌شده ${min(t.actual)}` : undefined, page: 'tasks' });
  }
  for (const e of db.timeEntries) add({ id: `te-${e.id}`, day: e.date, createdAt: e.createdAt, kind: 'focus', icon: '⏱', title: `تمرکز روی «${taskTitle.get(e.taskId) ?? 'کار حذف‌شده'}»`, detail: min(e.minutes), page: 'tasks' });
  for (const tr of db.learning) for (const l of tr.logs) {
    const bits = [min(l.minutes), l.keyPoints.length ? `${faNum(l.keyPoints.length)} نکته` : '', l.ideas.length ? `${faNum(l.ideas.length)} ایده` : ''].filter(Boolean);
    add({ id: `ll-${l.id}`, day: l.date, createdAt: l.createdAt, kind: 'learning', icon: '🎓', title: `${tr.title}: ${l.topic || 'جلسهٔ مطالعه'}`, detail: bits.join(' · '), page: 'learning' });
  }
  for (const x of db.transactions) add({ id: `tx-${x.id}`, day: x.date, createdAt: x.createdAt, kind: 'money', icon: x.type === 'income' ? '↓' : x.type === 'debt' ? '⚖' : '↑', title: `${x.type === 'income' ? 'درآمد' : x.type === 'debt' ? 'بدهی' : 'هزینه'}: ${x.title}`, detail: `${faNum(x.amount)} تومان${x.category ? ` · ${x.category}` : ''}`, page: 'finance' });
  for (const n of db.notes) add({ id: `nt-${n.id}`, day: dayOf(n.createdAt), createdAt: n.createdAt, kind: 'idea', icon: '💡', title: n.title || 'یادداشت بدون عنوان', detail: n.category, page: 'notes' });
  for (const w of db.wishes) {
    add({ id: `wn-${w.id}`, day: dayOf(w.createdAt), createdAt: w.createdAt, kind: 'wish', icon: '♦', title: `به ویش‌لیست اضافه شد: ${w.title}`, page: 'wishlist' });
    if (w.status === 'done' && w.completedAt) add({ id: `wd-${w.id}`, day: dayOf(w.completedAt), createdAt: w.completedAt, kind: 'wish', icon: '🏁', title: `تمام شد: ${w.title}`, page: 'wishlist' });
  }
  for (const e of db.events) add({ id: `ev-${e.id}`, day: e.date, kind: 'daily', icon: '▦', title: `بلوک زمانی: ${e.title}`, detail: `${e.start} — ${e.end}`, page: 'calendar' });

  for (const j of db.journal) add({ id: `jr-${j.id}`, day: j.date, createdAt: j.createdAt, kind: 'daily', icon: '✍', title: 'ثبت روزانه', detail: snippet(j, 80), page: 'journal' });

  for (const r of db.automationRuns) add({ id: `au-${r.id}`, day: dayOf(r.at), createdAt: r.at, kind: 'daily', icon: '⚡', title: `اتوماسیون: ${r.ruleName}`, detail: r.summary, page: 'automation' });

  const habitDays = new Map<string, number>();
  db.habits.forEach(h => Object.entries(h.entries).forEach(([d, v]) => { if (v >= h.target) habitDays.set(d, (habitDays.get(d) ?? 0) + 1); }));
  habitDays.forEach((n, d) => add({ id: `hb-${d}`, day: d, kind: 'daily', icon: '🔥', title: `عادت‌ها: ${faNum(n)} از ${faNum(db.habits.length)} انجام شد`, page: 'health' }));
  for (const h of db.health) add({ id: `hl-${h.id}`, day: h.date, kind: 'daily', icon: '♥', title: 'ثبت سلامت روزانه', detail: `خواب ${faNum(h.sleep)} ساعت · انرژی ${faNum(h.energy)} از ۵`, page: 'health' });

  return items.sort((a, b) => b.day.localeCompare(a.day) || b.ts - a.ts);
}

export const groupByDay = (items: TimelineItem[]): { day: string; items: TimelineItem[] }[] => {
  const out: { day: string; items: TimelineItem[] }[] = [];
  for (const i of items) { const last = out[out.length - 1]; if (last && last.day === i.day) last.items.push(i); else out.push({ day: i.day, items: [i] }); }
  return out;
};
