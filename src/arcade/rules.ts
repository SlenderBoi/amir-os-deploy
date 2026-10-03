import type { DB } from '../types';
import type { GameId } from './types';

/** Pure rules of the arcade (kept apart from the canvas code so they can be unit-tested). */
export const UNLOCK: Record<GameId, number> = { doodle: 1, hunt: 2, jinn: 3 };
export const MAX_BUFFS = 3;

export interface Arcade { best: Record<string, number>; meatSpent: number; buffs: number; plays: number }
export const emptyArcade = (): Arcade => ({ best: {}, meatSpent: 0, buffs: 0, plays: 0 });
const norm = (a?: Partial<Arcade>): Arcade => ({ ...emptyArcade(), ...a, best: { ...(a?.best ?? {}) } });

/** One piece of meat per finished task (real work feeds the wolf). */
export const meatEarned = (db: DB): number => db.tasks.filter(t => t.status === 'done').length;
export const meatLeft = (db: DB): number => Math.max(0, meatEarned(db) - (db.settings.arcade?.meatSpent ?? 0));

/** Spends one meat for one extra life in the next arcade run. Returns null when it's impossible. */
export function feedPet(a: Arcade | undefined, left: number): Arcade | null {
  const x = norm(a);
  if (left < 1 || x.buffs >= MAX_BUFFS) return null;
  return { ...x, meatSpent: x.meatSpent + 1, buffs: x.buffs + 1 };
}

/** Starting lives for a run; uses up one buff. */
export function startRun(a: Arcade | undefined): { arcade: Arcade; lives: number } {
  const x = norm(a);
  const bonus = x.buffs > 0 ? 1 : 0;
  return { arcade: { ...x, buffs: x.buffs - bonus }, lives: 3 + bonus };
}

export function recordRun(a: Arcade | undefined, id: GameId, score: number): { arcade: Arcade; record: boolean } {
  const x = norm(a);
  const record = score > (x.best[id] ?? 0);
  if (record) x.best[id] = score;
  x.plays += 1;
  return { arcade: x, record };
}

export const isUnlocked = (id: GameId, level: number) => level >= UNLOCK[id];

const HEIGHT_STAGES = [0, 100, 250, 450, 700, 1000];
export const stageForHeight = (meters: number): number => HEIGHT_STAGES.filter(t => meters >= t).length;
export const stageForCaught = (n: number): number => Math.min(8, 1 + Math.floor(n / 8));
export const isBossWave = (w: number) => w % 5 === 0;
export const waveSize = (w: number): number => (isBossWave(w) ? 3 + w : 5 + w * 3);
