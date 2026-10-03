import type { ActiveTimer, DB, TimeEntry } from '../types';
import { localISO } from './dates';
import { addDays } from './srs';

/** Anything shorter than this is treated as an accidental click and not recorded. */
export const MIN_TRACKED_SECONDS = 30;

export const elapsedSeconds = (timer: ActiveTimer, now: Date = new Date()): number =>
  Math.max(0, Math.floor((now.getTime() - new Date(timer.startedAt).getTime()) / 1000));

export const trackedMinutes = (seconds: number): number =>
  seconds < MIN_TRACKED_SECONDS ? 0 : Math.max(1, Math.round(seconds / 60));

export const formatClock = (seconds: number): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(seconds / 3600);
  return `${h ? p(h) + ':' : ''}${p(Math.floor((seconds % 3600) / 60))}:${p(seconds % 60)}`;
};

/** Starts a timer. Only one timer can run at a time; a second start is ignored (the UI disables it). */
export function startTimer(db: DB, target: Omit<ActiveTimer, 'startedAt'>, now: Date = new Date()): DB {
  if (db.timer) return db;
  const tasks = target.kind === 'task'
    ? db.tasks.map(t => t.id === target.refId && (t.status === 'todo' || t.status === 'inbox') ? { ...t, status: 'doing' as const, updatedAt: now.toISOString() } : t)
    : db.tasks;
  return { ...db, tasks, timer: { ...target, startedAt: now.toISOString() } };
}

export interface StopResult { db: DB; timer: ActiveTimer | null; minutes: number }

/** Stops the running timer. Task timers are written to the task and to the time log; learning timers just report minutes. */
export function stopTimer(db: DB, now: Date = new Date()): StopResult {
  const timer = db.timer;
  if (!timer) return { db, timer: null, minutes: 0 };
  const minutes = trackedMinutes(elapsedSeconds(timer, now));
  let next: DB = { ...db, timer: null };
  if (timer.kind === 'task' && minutes > 0 && db.tasks.some(t => t.id === timer.refId)) {
    const entry: TimeEntry = { id: crypto.randomUUID(), taskId: timer.refId, date: localISO(now), minutes, createdAt: now.toISOString() };
    next = {
      ...next,
      timeEntries: [entry, ...db.timeEntries],
      tasks: db.tasks.map(t => t.id === timer.refId ? { ...t, actual: t.actual + minutes, updatedAt: now.toISOString() } : t),
    };
  }
  return { db: next, timer, minutes };
}

export interface TimeStats {
  today: number;
  week: number;
  /** actual ÷ estimate over finished tasks that have tracked time; null when there is not enough data. */
  ratio: number | null;
  sample: number;
}

export function timeStats(db: DB, now: Date = new Date()): TimeStats {
  const today = localISO(now);
  const weekStart = addDays(today, -6);
  const sum = (from: string) => db.timeEntries.filter(e => e.date >= from && e.date <= today).reduce((a, e) => a + e.minutes, 0);
  const done = db.tasks.filter(t => t.status === 'done' && t.actual > 0 && t.estimate > 0);
  const est = done.reduce((a, t) => a + t.estimate, 0);
  const act = done.reduce((a, t) => a + t.actual, 0);
  return { today: sum(today), week: sum(weekStart), ratio: done.length >= 3 && est > 0 ? act / est : null, sample: done.length };
}

/** Plain-language advice for the estimate ratio: every metric must say what to do differently. */
export function estimateAdvice(ratio: number | null): string {
  if (ratio === null) return 'با ثبت زمان روی ۳ کار تمام‌شده، دقت تخمین‌هایت اینجا نمایش داده می‌شود.';
  const pct = new Intl.NumberFormat('fa-IR').format(Math.round(Math.abs(ratio - 1) * 100));
  if (ratio > 1.15) return `کارها معمولاً ${pct}٪ بیشتر از تخمینت طول می‌کشند؛ دفعهٔ بعد تخمین را بالاتر بگذار.`;
  if (ratio < 0.85) return `کارها ${pct}٪ زودتر از تخمین تمام می‌شوند؛ می‌توانی روزت را فشرده‌تر برنامه‌ریزی کنی.`;
  return 'تخمین‌هایت دقیق است. همین روش را ادامه بده.';
}
