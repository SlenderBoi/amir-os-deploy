import type { DB, NtfyConfig } from '../types';
import { dueCards } from './srs';
import { eventsOn } from './holidays';
import { addDaysISO, faDigits, formatJalali, isFriday } from './jalali';
import { localISO } from './dates';
import { isOpen, leadOf, taskAt } from './taskTime';

/**
 * Works out which phone notifications should exist for the next three days.
 * Pure function of (data, now, config): the sync layer diffs its output against what is already
 * scheduled on the ntfy server, so identical input produces zero network requests.
 */
export interface Planned { id: string; at: number; title: string; body: string; priority: 1 | 2 | 3 | 4 | 5; tags: string[] }

/** ntfy.sh refuses delays above 3 days; stay a little inside that. */
export const HORIZON_MS = 71.5 * 3600_000;
export const MIN_LEAD_MS = 30_000;

const at = (iso: string, hhmm: string) => new Date(`${iso}T${/^\d{2}:\d{2}$/.test(hhmm) ? hhmm : '08:00'}:00`).getTime();
const n = (x: number) => faDigits(x);
const clock = (hhmm: string) => faDigits(hhmm);

export function planReminders(db: DB, now: Date, cfg: NtfyConfig): Planned[] {
  const fix = db.settings.holidayFix ?? {};
  const out: Planned[] = [];
  const earliest = now.getTime() + MIN_LEAD_MS, latest = now.getTime() + HORIZON_MS;
  const push = (p: Planned) => { if (p.at >= earliest && p.at <= latest) out.push(p); };
  const today = localISO(now);
  const open = db.tasks.filter(t => t.status !== 'done' && t.status !== 'archived');

  for (let i = 0; i <= 3; i++) {
    const day = addDaysISO(today, i);

    if (cfg.digest) {
      const due = open.filter(t => t.due === day).sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
      const overdue = i === 0 ? open.filter(t => t.due && t.due < day) : [];
      const evs = db.events.filter(e => e.date === day).sort((a, b) => a.start.localeCompare(b.start));
      const reviews = dueCards(db, day).length;
      const off = eventsOn(day, fix).filter(o => o.off).map(o => o.title);
      if (due.length || overdue.length || evs.length || reviews || off.length) {
        const lines: string[] = [];
        if (off.length) lines.push(`🎌 ${off.join('، ')}`);
        if (cfg.showTitles) {
          due.slice(0, 5).forEach(t => lines.push(`• ${t.time ? `${clock(t.time)} ` : ''}${t.title}`));
          if (due.length > 5) lines.push(`… و ${n(due.length - 5)} کار دیگر`);
          evs.slice(0, 4).forEach(e => lines.push(`⏰ ${clock(e.start)} ${e.title}`));
        } else {
          if (due.length) lines.push(`${n(due.length)} کار با موعد امروز`);
          if (evs.length) lines.push(`${n(evs.length)} بلوک زمانی، اولی ساعت ${clock(evs[0].start)}`);
        }
        if (overdue.length) lines.push(`${n(overdue.length)} کار عقب‌افتاده`);
        if (reviews) lines.push(`${n(reviews)} کارت مرور آماده`);
        push({
          id: `d${day}-digest`, at: at(day, cfg.digestTime), title: `برنامهٔ ${i === 0 ? 'امروز' : formatJalali(day, { weekday: true, year: false })}`,
          body: lines.join('\n'), priority: [...due, ...overdue].some(t => t.priority === 'urgent') ? 4 : 3, tags: ['calendar'],
        });
      }
    }

    if (cfg.evening) {
      const missing: string[] = [];
      if (i === 0) {
        const habits = db.habits.filter(h => (h.entries[day] ?? 0) < h.target).length;
        if (habits) missing.push(`${n(habits)} عادت امروز انجام نشده`);
        const learnedToday = db.learning.some(t => t.logs.some(l => l.date === day));
        if (db.learning.some(t => t.status === 'active') && !learnedToday) missing.push('لاگ یادگیری امروز ثبت نشده');
      } else if (db.habits.length || db.learning.some(t => t.status === 'active')) {
        missing.push('عادت‌ها و لاگ یادگیری امروزت را ثبت کن');
      }
      if (missing.length) push({ id: `n${day}-evening`, at: at(day, cfg.eveningTime), title: 'قبل از خواب یه نگاه', body: missing.join('\n'), priority: 3, tags: ['crescent_moon'] });
    }

    if (cfg.weeklyReview && isFriday(day)) {
      push({ id: `w${day}-review`, at: at(day, '17:00'), title: 'وقت مرور هفتگی', body: 'یک ربع بنشین و هفته را جمع‌بندی کن.', priority: 3, tags: ['memo'] });
    }
  }

  if (cfg.events) {
    for (const e of db.events) {
      const start = at(e.date, e.start);
      push({
        id: `e-${e.id}`, at: start - cfg.eventLead * 60_000,
        title: cfg.showTitles ? e.title : 'بلوک زمانی',
        body: `${cfg.eventLead > 0 ? `${n(cfg.eventLead)} دقیقه دیگر · ` : ''}ساعت ${clock(e.start)}`,
        priority: e.kind === 'reminder' ? 5 : 4, tags: ['alarm_clock'],
      });
    }
  }

  // timed tasks: one alarm per task, `lead` minutes before (same on/off switch as time blocks)
  if (cfg.events) {
    const lead = leadOf(db);
    for (const t of db.tasks.filter(isOpen)) {
      const start = taskAt(t);
      if (start === null) continue;
      push({
        id: `k-${t.id}-${t.due}-${t.time!.replace(':', '')}`, at: start - lead * 60_000,
        title: cfg.showTitles ? t.title : 'کار ساعت‌دار',
        body: `${lead > 0 ? `${n(lead)} دقیقه دیگر · ` : ''}ساعت ${clock(t.time!)}`,
        priority: t.priority === 'urgent' ? 5 : t.priority === 'high' ? 4 : 3, tags: ['alarm_clock'],
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export const planSummary = (plan: Planned[]) => ({
  count: plan.length,
  next: plan[0] ? { at: plan[0].at, title: plan[0].title } : null,
});
