import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import { computeXp, petMood, petStage, XP_PER_LEVEL } from './pet';
import type { DB, Task } from '../types';

const empty = (): DB => ({ ...structuredClone(seed), tasks: [], notes: [], wishes: [], learning: [], habits: [] });
const task = (over: Partial<Task>): Task => ({ id: Math.random().toString(), title: 't', description: '', status: 'todo', priority: 'low', estimate: 0, actual: 0, tags: [], subtasks: [], notes: '', createdAt: '', updatedAt: '', ...over });

describe('pet xp', () => {
  it('starts at level 1 with zero xp', () => expect(computeXp(empty())).toMatchObject({ total: 0, level: 1, levelXp: 0 }));
  it('gives 25 xp per finished task and levels up at 250', () => {
    const db = empty();
    db.tasks = Array.from({ length: 10 }, () => task({ status: 'done' }));
    expect(computeXp(db)).toMatchObject({ total: 250, level: 2, levelXp: 0 });
    expect(XP_PER_LEVEL).toBe(250);
  });
  it('counts learning minutes and key points', () => {
    const db = empty();
    db.learning = [{ ...seed.learning[0], logs: [{ id: 'l', date: '2026-10-01', minutes: 50, topic: 'x', notes: '', keyPoints: ['a', 'b'], ideas: ['c'], createdAt: '' }] }];
    expect(computeXp(db).total).toBe(10 + 9);
  });
});

describe('pet stage and mood', () => {
  it('evolves at the configured levels', () => {
    expect(petStage(1).title).toBe('توله‌گرگ');
    expect(petStage(6).title).toBe('گرگ سایه');
    expect(petStage(20).next).toBeUndefined();
  });
  it('is sleepy at 3am, hungry in the evening with no activity, proud when today is done', () => {
    const db = empty();
    expect(petMood(db, new Date(2026, 9, 1, 3))).toBe('sleepy');
    expect(petMood(db, new Date(2026, 9, 1, 18))).toBe('hungry');
    db.tasks = [task({ due: '2026-10-01', status: 'done', completedAt: new Date(2026, 9, 1, 10).toISOString() })];
    expect(petMood(db, new Date(2026, 9, 1, 18))).toBe('proud');
  });
});
