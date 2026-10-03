import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import { elapsedSeconds, estimateAdvice, formatClock, startTimer, stopTimer, timeStats, trackedMinutes } from './timer';
import type { DB, Task } from '../types';

const task = (over: Partial<Task>): Task => ({ id: 't1', title: 'کار', description: '', status: 'todo', priority: 'low', estimate: 60, actual: 0, tags: [], subtasks: [], notes: '', createdAt: '', updatedAt: '', ...over });
const base = (): DB => ({ ...structuredClone(seed), tasks: [task({})], timeEntries: [], timer: null });
const t0 = new Date(2026, 9, 1, 10, 0, 0);
const after = (s: number) => new Date(t0.getTime() + s * 1000);

describe('timer', () => {
  it('formats clocks', () => { expect(formatClock(65)).toBe('01:05'); expect(formatClock(3725)).toBe('01:02:05'); });
  it('ignores accidental clicks under 30s and rounds the rest', () => {
    expect(trackedMinutes(29)).toBe(0); expect(trackedMinutes(30)).toBe(1); expect(trackedMinutes(25 * 60 + 20)).toBe(25);
  });
  it('starting moves a todo task to doing and a second start is ignored', () => {
    const a = startTimer(base(), { kind: 'task', refId: 't1', label: 'کار' }, t0);
    expect(a.tasks[0].status).toBe('doing');
    expect(startTimer(a, { kind: 'learning', refId: 'x', label: 'y' }, t0)).toBe(a);
  });
  it('stopping adds minutes to the task and the time log', () => {
    const running = startTimer(base(), { kind: 'task', refId: 't1', label: 'کار' }, t0);
    expect(elapsedSeconds(running.timer!, after(90))).toBe(90);
    const r = stopTimer(running, after(25 * 60));
    expect(r.minutes).toBe(25);
    expect(r.db.timer).toBeNull();
    expect(r.db.tasks[0].actual).toBe(25);
    expect(r.db.timeEntries[0]).toMatchObject({ taskId: 't1', minutes: 25, date: '2026-10-01' });
  });
  it('a learning timer reports minutes but touches no task', () => {
    const r = stopTimer(startTimer(base(), { kind: 'learning', refId: 'l1', label: 'پایتون' }, t0), after(600));
    expect(r.minutes).toBe(10); expect(r.db.timeEntries).toHaveLength(0);
  });
  it('computes today/week minutes and the estimate ratio', () => {
    const db = base();
    db.timeEntries = [
      { id: 'a', taskId: 't1', date: '2026-10-01', minutes: 30, createdAt: '' },
      { id: 'b', taskId: 't1', date: '2026-09-27', minutes: 20, createdAt: '' },
      { id: 'c', taskId: 't1', date: '2026-09-01', minutes: 99, createdAt: '' },
    ];
    db.tasks = [1, 2, 3].map(i => task({ id: `d${i}`, status: 'done', estimate: 60, actual: 90 }));
    const s = timeStats(db, after(0));
    expect(s).toMatchObject({ today: 30, week: 50, sample: 3 });
    expect(s.ratio).toBeCloseTo(1.5);
    expect(estimateAdvice(s.ratio)).toContain('۵۰٪');
    expect(estimateAdvice(null)).toContain('۳ کار');
  });
});
