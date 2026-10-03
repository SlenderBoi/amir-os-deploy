import type { DB, LearningLog, ReviewState } from '../types';
import { localISO } from './dates';

/** Local-date arithmetic on YYYY-MM-DD strings (DST-safe because it builds a local Date). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return localISO(new Date(y, m - 1, d + days));
}

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export const GRADE_LABEL: Record<Grade, string> = { again: 'یادم نبود', hard: 'سخت بود', good: 'خوب بود', easy: 'خیلی آسان' };

/** A simplified SM-2 style scheduler. Intervals are whole days. */
export function nextState(prev: ReviewState | undefined, grade: Grade, today: string): ReviewState {
  const reps = prev?.reps ?? 0;
  const interval = prev?.interval ?? 0;
  let days: number;
  let nextReps = reps + 1;
  switch (grade) {
    case 'again': days = 1; nextReps = 0; break;
    case 'hard': days = Math.max(1, Math.round(Math.max(interval, 1) * 1.2)); break;
    case 'good': days = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * 2.5); break;
    case 'easy': days = reps === 0 ? 3 : Math.max(4, Math.round(interval * 3.5)); break;
  }
  return { due: addDays(today, days), interval: days, reps: nextReps };
}

export interface ReviewCard {
  log: LearningLog;
  trackId: string;
  trackTitle: string;
  color: string;
  due: string;
}

/** A lesson is reviewable when it has something to recall. First review is the day after it was logged. */
export const isReviewable = (log: LearningLog): boolean => log.keyPoints.length > 0 || log.notes.trim().length > 0;

export function dueCards(db: DB, today: string = localISO()): ReviewCard[] {
  return db.learning
    .flatMap(track => track.logs.filter(isReviewable).map(log => ({
      log, trackId: track.id, trackTitle: track.title, color: track.color,
      due: db.reviews[log.id]?.due ?? addDays(log.date, 1),
    })))
    .filter(c => c.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || a.log.createdAt.localeCompare(b.log.createdAt));
}
