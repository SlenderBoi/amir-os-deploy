import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import { addDays, BOSS_TARGET, bossFor, coachLines, gameState, PERFECT_DAY_XP, QUEST_XP, questsFor, streakOf, weekStartOf } from './game';
import type { DB, Task } from '../types';

const empty = (): DB => ({ ...structuredClone(seed), tasks: [], notes: [], wishes: [], learning: [], habits: [], journal: [], timeEntries: [] });
const done = (date: string, hour = 12, over: Partial<Task> = {}): Task => ({
  id: Math.random().toString(), title: 't', description: '', status: 'done', priority: 'low', estimate: 0, actual: 0, tags: [], subtasks: [], notes: '',
  createdAt: '', updatedAt: '', completedAt: new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8), hour).toISOString(), ...over,
});
const NOW = new Date(2026, 9, 3, 15); // Saturday 2026-10-03

describe('daily quests', () => {
  it('starts empty and reports progress per day', () => {
    const g = gameState(empty(), NOW);
    expect(g.questsDone).toBe(0);
    expect(g.xp.total).toBe(0);
    const db = empty();
    db.tasks = [done('2026-10-03'), done('2026-10-03')];
    expect(gameState(db, NOW).quests[0]).toMatchObject({ id: 'tasks', progress: 2, done: false });
  });
  it('uses an idea quest when there are no habits, a habit quest otherwise', () => {
    const db = empty();
    expect(questsFor(db)[2].id).toBe('idea');
    db.habits = [{ id: 'h', title: 'x', target: 1, unit: '', color: '', entries: {} }];
    expect(questsFor(db)[2].id).toBe('habit');
  });
  it('pays 10 XP per quest and a bonus for a perfect day (on top of the base XP)', () => {
    const db = empty();
    db.tasks = [done('2026-10-03'), done('2026-10-03'), done('2026-10-03')];
    const g = gameState(db, NOW);
    expect(g.questsDone).toBe(1);
    expect(g.xp.parts.find(p => p.label === 'مأموریت‌های روزانه')!.xp).toBe(QUEST_XP);
    db.learning = [{ ...seed.learning[0], logs: [{ id: 'l', date: '2026-10-03', minutes: 30, topic: '', notes: '', keyPoints: [], ideas: [], createdAt: '' }] }];
    db.notes = [{ id: 'n', title: 'i', body: '', category: '', tags: [], pinned: false, createdAt: new Date(2026, 9, 3, 9).toISOString(), updatedAt: '' }];
    db.journal = [{ id: 'j', date: '2026-10-03', intentions: [], wins: 'خوب', improve: '', gratitude: '', note: '', createdAt: '', updatedAt: '' }];
    const p = gameState(db, NOW);
    expect(p.perfectToday).toBe(true);
    expect(p.perfectDays).toBe(1);
    expect(p.xp.parts.find(x => x.label === 'مأموریت‌های روزانه')!.xp).toBe(4 * QUEST_XP + PERFECT_DAY_XP);
  });
  it('counts time entries as focus minutes', () => {
    const db = empty();
    db.timeEntries = [{ id: 'e', taskId: 't', date: '2026-10-03', minutes: 25, createdAt: '' }];
    expect(gameState(db, NOW).quests[1].done).toBe(true);
  });
});

describe('streak', () => {
  const set = (...d: string[]) => new Set(d);
  it('counts back from today, or yesterday when today is not done yet (at risk)', () => {
    expect(streakOf(set('2026-10-03', '2026-10-02', '2026-10-01'), '2026-10-03')).toMatchObject({ current: 3, best: 3, atRisk: false });
    expect(streakOf(set('2026-10-02', '2026-10-01'), '2026-10-03')).toMatchObject({ current: 2, atRisk: true, activeToday: false });
    expect(streakOf(set('2026-09-20'), '2026-10-03')).toMatchObject({ current: 0, best: 1, atRisk: false });
  });
  it('remembers the best run and crosses month boundaries', () => {
    expect(streakOf(set('2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05'), '2026-10-05')).toMatchObject({ current: 1, best: 4 });
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });
  it('is driven by real data', () => {
    const db = empty();
    db.tasks = [done('2026-10-01'), done('2026-10-02'), done('2026-10-03')];
    // a single finished task does not complete the 3-task quest, so no streak
    expect(gameState(db, NOW).streak.current).toBe(0);
    db.notes = ['01', '02', '03'].map(d => ({ id: d, title: 'i', body: '', category: '', tags: [], pinned: false, createdAt: new Date(2026, 9, +d, 9).toISOString(), updatedAt: '' }));
    expect(gameState(db, NOW).streak).toMatchObject({ current: 3, best: 3 });
  });
});

describe('weekly boss', () => {
  it('week starts on Saturday or Monday', () => {
    expect(weekStartOf('2026-10-03', true)).toBe('2026-10-03');
    expect(weekStartOf('2026-10-07', true)).toBe('2026-10-03');
    expect(weekStartOf('2026-10-03', false)).toBe('2026-09-28');
  });
  it('loses hp per finished task and pays once when defeated', () => {
    const db = empty();
    db.settings.weekStartsSaturday = true;
    db.tasks = Array.from({ length: 5 }, () => done('2026-10-04'));
    expect(bossFor(db, '2026-10-05')).toMatchObject({ dealt: 5, hp: BOSS_TARGET - 5, defeated: false });
    db.tasks = Array.from({ length: BOSS_TARGET }, () => done('2026-10-04'));
    const g = gameState(db, NOW);
    expect(g.boss.defeated).toBe(true);
    expect(g.bossesDefeated).toBe(1);
    expect(g.badges.find(b => b.id === 'boss1')!.done).toBe(true);
    expect(g.badges.find(b => b.id === 'hunter10')!.done).toBe(true);
  });
  it('tasks from last week do not hurt this week\'s boss', () => {
    const db = empty();
    db.settings.weekStartsSaturday = true;
    db.tasks = [done('2026-09-30')];
    expect(bossFor(db, '2026-10-03').dealt).toBe(0);
  });
});

describe('badges and coach', () => {
  it('detects early birds by local completion hour', () => {
    const db = empty();
    db.tasks = Array.from({ length: 5 }, () => done('2026-10-01', 6));
    const g = gameState(db, NOW);
    expect(g.badges.find(b => b.id === 'early')!.done).toBe(true);
    expect(g.badges.find(b => b.id === 'late')!.done).toBe(false);
  });
  it('warns about a streak at risk in the evening and announces upcoming timed tasks', () => {
    const db = empty();
    db.notes = ['01', '02'].map(d => ({ id: d, title: 'i', body: '', category: '', tags: [], pinned: false, createdAt: new Date(2026, 9, +d, 9).toISOString(), updatedAt: '' }));
    const evening = new Date(2026, 9, 3, 19);
    expect(coachLines(db, gameState(db, evening), evening)[0]).toContain('می‌پره');
    db.tasks = [{ ...done('2026-10-03'), status: 'todo', completedAt: undefined, due: '2026-10-03', time: '19:30', title: 'قرار' }];
    expect(coachLines(db, gameState(db, evening), evening).some(l => l.includes('19:30'))).toBe(true);
  });
  it('lines are unique and non-empty', () => {
    const l = coachLines(empty(), gameState(empty(), NOW), NOW);
    expect(l.length).toBeGreaterThan(2);
    expect(new Set(l).size).toBe(l.length);
  });
});
