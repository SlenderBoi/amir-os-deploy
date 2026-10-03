import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import type { DB, Task } from '../types';
import { feedPet, isBossWave, isUnlocked, MAX_BUFFS, meatLeft, recordRun, stageForCaught, stageForHeight, startRun, waveSize } from './rules';
import { gameState } from '../services/game';

const task = (status: Task['status']): Task => ({ id: Math.random().toString(), title: 't', description: '', status, priority: 'low', estimate: 0, actual: 0, tags: [], subtasks: [], notes: '', createdAt: '', updatedAt: '' });
const db = (): DB => ({ ...structuredClone(seed), tasks: [], notes: [], wishes: [], learning: [], habits: [], journal: [], timeEntries: [] });

describe('arcade rules', () => {
  it('games unlock by pet level', () => {
    expect(isUnlocked('doodle', 1)).toBe(true);
    expect(isUnlocked('hunt', 1)).toBe(false);
    expect(isUnlocked('hunt', 2)).toBe(true);
    expect(isUnlocked('jinn', 2)).toBe(false);
    expect(isUnlocked('jinn', 3)).toBe(true);
  });
  it('meat = finished tasks minus meat already fed', () => {
    const d = db(); d.tasks = [task('done'), task('done'), task('todo')];
    expect(meatLeft(d)).toBe(2);
    d.settings.arcade = { best: {}, meatSpent: 1, buffs: 1, plays: 0 };
    expect(meatLeft(d)).toBe(1);
    d.settings.arcade.meatSpent = 5;
    expect(meatLeft(d)).toBe(0);
  });
  it('feeding spends meat for an extra-life buff, capped', () => {
    expect(feedPet(undefined, 0)).toBeNull();
    const a = feedPet(undefined, 3)!;
    expect(a).toMatchObject({ meatSpent: 1, buffs: 1 });
    let x = a; for (let i = 0; i < 5; i++) x = feedPet(x, 9) ?? x;
    expect(x.buffs).toBe(MAX_BUFFS);
    expect(feedPet(x, 9)).toBeNull();
  });
  it('a run uses one buff for a 4th life', () => {
    expect(startRun(undefined)).toMatchObject({ lives: 3 });
    const r = startRun({ best: {}, meatSpent: 2, buffs: 2, plays: 0 });
    expect(r.lives).toBe(4);
    expect(r.arcade.buffs).toBe(1);
  });
  it('keeps the best score and counts plays', () => {
    let r = recordRun(undefined, 'hunt', 40);
    expect(r.record).toBe(true);
    r = recordRun(r.arcade, 'hunt', 25);
    expect(r).toMatchObject({ record: false, arcade: { best: { hunt: 40 }, plays: 2 } });
    expect(recordRun(r.arcade, 'hunt', 90).arcade.best.hunt).toBe(90);
  });
  it('stage curves are monotonic', () => {
    expect([0, 99, 100, 249, 250, 1000].map(stageForHeight)).toEqual([1, 1, 2, 2, 3, 6]);
    expect([0, 7, 8, 16, 200].map(stageForCaught)).toEqual([1, 1, 2, 3, 8]);
    expect(waveSize(2)).toBeGreaterThan(waveSize(1));
    expect(isBossWave(5)).toBe(true);
    expect(waveSize(5)).toBeLessThan(waveSize(4) + 1);
  });
  it('arcade high scores unlock badges', () => {
    const d = db();
    expect(gameState(d, new Date(2026, 9, 3, 12)).badges.find(b => b.id === 'arc-doodle')!.done).toBe(false);
    d.settings.arcade = { best: { doodle: 120 }, meatSpent: 0, buffs: 0, plays: 1 };
    expect(gameState(d, new Date(2026, 9, 3, 12)).badges.find(b => b.id === 'arc-doodle')!.done).toBe(true);
  });
});
