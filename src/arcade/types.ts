import type { Sprites } from './engine';

export type GameId = 'doodle' | 'hunt' | 'jinn';
export interface HudState { score: number; stage: number; lives: number }
export interface Upgrade { id: string; icon: string; title: string; desc: string }
export interface GameCallbacks {
  hud(h: HudState): void;
  stage(n: number): void;
  over(r: { score: number; stage: number }): void;
  /** Roguelike pick between waves. The game is paused until `pick` is called. */
  upgrade?(options: Upgrade[], pick: (i: number) => void): void;
}
export interface GameDef {
  id: GameId; title: string; icon: string; blurb: string; controls: string;
  /** pet level needed to play */
  unlock: number;
  w: number; h: number;
  start(canvas: HTMLCanvasElement, sprites: Sprites, cb: GameCallbacks, opts: { lives: number }): () => void;
}
