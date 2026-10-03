import type { DB, Task } from '../types';
import { addDaysISO, faDigits } from './jalali';
import { localISO } from './dates';

/** Time-of-day for tasks ("HH:MM", 24h) and the alarm that rings a few minutes before it. */
export const DEFAULT_LEAD = 10;
export const LEADS = [0, 5, 10, 15, 30, 60];
/** An alarm is still shown if the app is opened up to this long after the task's time. */
export const GRACE_MS = 30 * 60_000;

/** "7:30", "07:30", "7", "19", "۷:۳۰" → "07:30" (null when it is not a real time). */
export function normalizeTime(input: string): string | null {
  const ascii = input.trim().replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const m = ascii.match(/^(\d{1,2})(?:[:٫.](\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), min = m[2] === undefined ? 0 : Number(m[2]);
  return h > 23 || min > 59 ? null : `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export const leadOf = (db: Pick<DB, 'settings'>): number => { const v = db.settings.taskLead; return typeof v === 'number' && v >= 0 && v <= 1440 ? v : DEFAULT_LEAD; };
export const faTime = (t: string) => faDigits(t);
export const isOpen = (t: Task) => t.status !== 'done' && t.status !== 'archived';

/** Moment (ms) a timed task starts, or null if it has no date or time. */
export function taskAt(t: Pick<Task, 'due' | 'time'>): number | null {
  if (!t.due || !t.time || !normalizeTime(t.time)) return null;
  const ms = new Date(`${t.due}T${t.time}:00`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Which day a bare time means: today if it is still ahead, otherwise tomorrow. */
export function defaultDayFor(time: string, now: Date = new Date()): string {
  const today = localISO(now);
  return new Date(`${today}T${time}:00`).getTime() > now.getTime() ? today : addDaysISO(today, 1);
}

export interface Ring { key: string; task: Task; at: number; alarmAt: number }
/** `key` identifies one ring of one alarm: changing the time, date or lead gives a new key, so edits re-arm it. */
export const ringKey = (t: Task, lead: number) => `${t.id}|${t.due}|${t.time}|${lead}`;

/** Alarms whose moment has come (and whose task is not over by more than the grace period), not yet fired. */
export function dueRings(db: DB, now: Date, fired: ReadonlySet<string>): Ring[] {
  const lead = leadOf(db), ms = now.getTime();
  return db.tasks.filter(isOpen).flatMap(t => {
    const at = taskAt(t);
    if (at === null) return [];
    const alarmAt = at - lead * 60_000, key = ringKey(t, lead);
    return ms >= alarmAt && ms < at + GRACE_MS && !fired.has(key) ? [{ key, task: t, at, alarmAt }] : [];
  }).sort((a, b) => a.at - b.at);
}

/** "۱۰ دقیقه دیگر" / "الان" / "۵ دقیقه پیش" relative to the task's time. */
export function whenText(at: number, now: number): string {
  const min = Math.round((at - now) / 60_000);
  if (min > 0) return `${faDigits(min)} دقیقه دیگر`;
  if (min === 0) return 'الان';
  return `${faDigits(-min)} دقیقه پیش`;
}
