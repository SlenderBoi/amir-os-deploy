import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import { addDays, dueCards, nextState } from './srs';
import { minutesByDate, studyStreak, trackMarkdown } from './learning';
import type { DB, LearningLog } from '../types';

const log = (over: Partial<LearningLog>): LearningLog => ({ id: 'l1', date: '2026-10-01', minutes: 30, topic: 'decorators', notes: '', keyPoints: ['a'], ideas: [], createdAt: '2026-10-01T10:00:00Z', ...over });
const dbWith = (logs: LearningLog[]): DB => ({ ...structuredClone(seed), reviews: {}, learning: [{ ...seed.learning[0], logs }] });

describe('addDays', () => {
  it('crosses month and year boundaries', () => { expect(addDays('2026-10-31', 1)).toBe('2026-11-01'); expect(addDays('2026-01-01', -1)).toBe('2025-12-31'); });
});

describe('spaced repetition', () => {
  it('first review is due the day after learning', () => {
    const db = dbWith([log({})]);
    expect(dueCards(db, '2026-10-01')).toHaveLength(0);
    expect(dueCards(db, '2026-10-02')).toHaveLength(1);
  });
  it('skips lessons with nothing to recall', () => expect(dueCards(dbWith([log({ keyPoints: [], notes: '  ' })]), '2026-12-01')).toHaveLength(0));
  it('grows intervals: good → 1d, 3d, then ×2.5', () => {
    let s = nextState(undefined, 'good', '2026-10-02'); expect(s).toMatchObject({ interval: 1, due: '2026-10-03', reps: 1 });
    s = nextState(s, 'good', '2026-10-03'); expect(s.interval).toBe(3);
    s = nextState(s, 'good', '2026-10-06'); expect(s.interval).toBe(8);
  });
  it('resets on "again" and jumps on "easy"', () => {
    expect(nextState({ due: 'x', interval: 8, reps: 4 }, 'again', '2026-10-10')).toMatchObject({ interval: 1, reps: 0, due: '2026-10-11' });
    expect(nextState(undefined, 'easy', '2026-10-10').interval).toBe(3);
  });
  it('a reviewed card leaves the queue until its new due date', () => {
    const db = dbWith([log({})]); db.reviews = { l1: { due: '2026-10-09', interval: 7, reps: 2 } };
    expect(dueCards(db, '2026-10-08')).toHaveLength(0);
    expect(dueCards(db, '2026-10-09')).toHaveLength(1);
  });
});

describe('learning stats', () => {
  it('sums minutes per day and finds streaks', () => {
    const logs = [log({ id: '1', date: '2026-10-01', minutes: 20 }), log({ id: '2', date: '2026-10-01', minutes: 10 }), log({ id: '3', date: '2026-09-30' }), log({ id: '4', date: '2026-09-28' })];
    const by = minutesByDate([{ ...seed.learning[0], logs }]);
    expect(by['2026-10-01']).toBe(30);
    expect(studyStreak(by, '2026-10-01')).toEqual({ current: 2, longest: 2 });
    expect(studyStreak(by, '2026-10-02').current).toBe(2); // today empty: streak is still alive
    expect(studyStreak(by, '2026-10-05').current).toBe(0);
  });
  it('exports Markdown oldest-first', () => {
    const md = trackMarkdown({ ...seed.learning[0], title: 'پایتون', logs: [log({ id: '2', date: '2026-10-02', topic: 'B' }), log({ id: '1', date: '2026-10-01', topic: 'A', ideas: ['idea'] })] });
    expect(md.indexOf('— A')).toBeLessThan(md.indexOf('— B'));
    expect(md).toContain('# پایتون'); expect(md).toContain('- idea');
  });
});
