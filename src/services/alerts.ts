import type { DB } from '../types';
import { dueCards } from './srs';
import { eventsOn } from './holidays';
import { addDaysISO, faDigits, isFriday } from './jalali';
import { localISO } from './dates';
import { entryFor } from './journal';
import { faTime, leadOf, taskAt, whenText } from './taskTime';

/**
 * "Needs attention" list for the bell. It is a pure function of the data and the clock, so nothing is
 * stored except which ids the user already marked as read. Ids carry the day (and the count when it
 * matters), so a rule that fires again tomorrow, or with a new number, shows up as new.
 */
export type AlertPage = 'tasks' | 'calendar' | 'learning' | 'health' | 'journal' | 'finance' | 'review' | 'dashboard';
export interface Alert { id: string; level: 'urgent' | 'warn' | 'info'; title: string; detail?: string; page: AlertPage }

const n = faDigits;
const minutesOf = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);

export const EVENING_HOUR = 18;   // habit and journal nudges start here
export const MORNING_END = 12;    // "plan your day" nudge stops at noon
export const FORGOTTEN_TIMER_MIN = 180;

export function buildAlerts(db: DB, now: Date = new Date()): Alert[] {
  const out: Alert[] = [];
  const day = localISO(now), hour = now.getHours(), nowMin = hour * 60 + now.getMinutes();
  const open = db.tasks.filter(t => t.status !== 'done' && t.status !== 'archived');

  // 1. a timer someone forgot
  if (db.timer) {
    const mins = Math.floor((now.getTime() - Date.parse(db.timer.startedAt)) / 60000);
    if (mins >= FORGOTTEN_TIMER_MIN) out.push({ id: `timer:${db.timer.startedAt}`, level: 'warn', title: `تایمر «${db.timer.label}» ${n(Math.floor(mins / 60))} ساعت است روشن مانده`, detail: 'اگر کار تمام شده، متوقفش کن تا آمار تمرکزت خراب نشود.', page: db.timer.kind === 'learning' ? 'learning' : 'tasks' });
  }

  // 1b. messages from your own automation rules (kept for a week)
  for (const m of db.notices.filter(x => now.getTime() - Date.parse(x.at) < 7 * 86400_000).sort((a, b) => b.at.localeCompare(a.at)))
    out.push({ id: `notice:${m.id}`, level: 'info', title: m.title, detail: m.body ?? 'از قانون اتوماسیون', page: m.page });

  // 2. tasks
  const overdue = open.filter(t => t.due && t.due < day).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
  if (overdue.length) out.push({ id: `overdue:${day}:${overdue.length}`, level: 'urgent', title: `${n(overdue.length)} کار عقب‌افتاده`, detail: `قدیمی‌ترین: «${overdue[0].title}»`, page: 'tasks' });
  const dueToday = open.filter(t => t.due === day);
  if (dueToday.length) out.push({ id: `due:${day}:${dueToday.length}`, level: 'warn', title: `${n(dueToday.length)} کار برای امروز`, detail: dueToday.slice(0, 2).map(t => `«${t.title}»`).join('، ') + (dueToday.length > 2 ? '، …' : ''), page: 'tasks' });

  // 2b. timed tasks that are about to start (inside the alarm lead) or have just started
  const lead = leadOf(db);
  for (const t of open) {
    const at = taskAt(t);
    if (at === null) continue;
    const left = at - now.getTime();
    if (left <= lead * 60_000 && left > -30 * 60_000) out.push({ id: `tt:${t.id}:${t.due}:${t.time}`, level: left > 0 ? 'warn' : 'urgent', title: `${whenText(at, now.getTime())}: ${t.title}`, detail: `ساعت ${faTime(t.time!)}`, page: 'tasks' });
  }

  // 3. today's schedule: what starts in the next two hours, or is running now
  for (const e of db.events.filter(x => x.date === day).sort((a, b) => a.start.localeCompare(b.start))) {
    const s = minutesOf(e.start), f = minutesOf(e.end);
    if (nowMin >= s && nowMin < f) out.push({ id: `ev:${e.id}:${day}:now`, level: 'info', title: `الان: ${e.title}`, detail: `${n(e.start)} تا ${n(e.end)}`, page: 'calendar' });
    else if (s > nowMin && s - nowMin <= 120) out.push({ id: `ev:${e.id}:${day}:soon`, level: 'warn', title: `${n(s - nowMin)} دقیقهٔ دیگر: ${e.title}`, detail: `ساعت ${n(e.start)}`, page: 'calendar' });
  }

  // 4. tomorrow is a day off
  const off = eventsOn(addDaysISO(day, 1), db.settings.holidayFix ?? {}).filter(o => o.off);
  if (off.length) out.push({ id: `off:${addDaysISO(day, 1)}`, level: 'info', title: `فردا تعطیل است: ${off[0].title}`, page: 'calendar' });

  // 5. spaced-repetition cards
  const cards = dueCards(db, day).length;
  if (cards) out.push({ id: `srs:${day}:${cards}`, level: 'info', title: `${n(cards)} کارت مرور آمادهٔ مرور است`, detail: 'چند دقیقه مرور، یادگیری را ماندگار می‌کند.', page: 'learning' });

  // 6. daily page and habits
  const page = entryFor(db.journal, day);
  if (hour < MORNING_END && !page?.intentions.length) out.push({ id: `plan:${day}`, level: 'info', title: 'اولویت‌های امروز را بنویس', detail: 'سه چیزی که امروز واقعاً مهم است.', page: 'journal' });
  if (hour >= EVENING_HOUR) {
    const undone = db.habits.filter(h => (h.entries[day] ?? 0) < h.target);
    if (undone.length && db.habits.length) out.push({ id: `habits:${day}:${undone.length}`, level: 'warn', title: `${n(undone.length)} عادت امروز هنوز انجام نشده`, detail: undone.slice(0, 3).map(h => `«${h.title}»`).join('، '), page: 'health' });
    if (!(page && (page.wins.trim() || page.improve.trim() || page.gratitude.trim() || page.note.trim()))) out.push({ id: `reflect:${day}`, level: 'info', title: 'مرور شبانهٔ امروز را ننوشته‌ای', detail: 'دو خط دربارهٔ امروز کافی است.', page: 'journal' });
  }

  // 7. weekly review (Friday) and open debts
  if (isFriday(day)) out.push({ id: `review:${day}`, level: 'info', title: 'جمعه است؛ وقت مرور هفته', page: 'review' });
  const debts = db.transactions.filter(t => t.type === 'debt' && !t.paid);
  if (debts.length) out.push({ id: `debt:${day}:${debts.length}`, level: 'info', title: `${n(debts.length)} مطالبهٔ باز`, detail: 'در صفحهٔ مالی ببین چه چیزی هنوز تسویه نشده.', page: 'finance' });

  const rank = { urgent: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Keeps the dismissed list from growing forever. */
export const pruneDismissed = (ids: string[], keep = 150): string[] => [...new Set(ids)].slice(-keep);
