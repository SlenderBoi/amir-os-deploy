import { bands, clamp, createInput, rand, rectsHit, runLoop, sprite } from './engine';
import { stageForCaught } from './rules';
import type { GameDef } from './types';

const W = 480, H = 270, GROUND = 214;
const THEMES: [string, string][] = [['#1b0d33', '#5b2a86'], ['#0f172a', '#4c1d95'], ['#2a0a3a', '#be185d'], ['#02040f', '#14143a'], ['#2a0510', '#be123c'], ['#0b1a2a', '#0e7490'], ['#1f1305', '#b45309'], ['#05010a', '#3b0764']];
interface Obj { t: 'rabbit' | 'rock' | 'trap' | 'fire'; x: number; y: number; w: number; h: number; vy: number; hop: boolean }
interface Puff { x: number; y: number; vx: number; vy: number; life: number; c: string }

/** Side-scrolling hunt: the wolf runs on its own, jump (twice!) to catch rabbits and dodge rocks, traps and fire. */
export const hunt: GameDef = {
  id: 'hunt', title: 'شکار شبانه', icon: '🐇', unlock: 2, w: W, h: H,
  blurb: 'گرگ خودش می‌دود؛ بپر، خرگوش‌ها را بگیر و از سنگ، تله و آتش جا خالی بده.',
  controls: 'فاصله / ↑ یا لمس صفحه (دو پرش پشت‌سرهم ممکن است)',
  start(canvas, S, cb, opts) {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    const input = createInput(canvas, W, H);
    const wolf = { x: 70, y: GROUND - 33, vy: 0, w: 48, h: 33, jumps: 0 };
    const objs: Obj[] = [], puffs: Puff[] = [];
    let lives = opts.lives, caught = 0, dist = 0, stage = 1, inv = 0, nextSpawn = 200, t = 0, hudT = 0, shake = 0;
    const speed = () => 190 + stage * 36;
    const score = () => caught * 10 + Math.floor(dist / 100);
    const burst = (x: number, y: number, c: string, n = 8) => { for (let i = 0; i < n; i++) puffs.push({ x, y, vx: rand(-90, 90), vy: rand(-150, -20), life: rand(0.3, 0.7), c }); };

    const spawn = () => {
      const r = Math.random();
      if (r < 0.52) {
        const hop = stage >= 2 && Math.random() < 0.5;
        objs.push({ t: 'rabbit', x: W + 20, y: GROUND - 21, w: 24, h: 21, vy: 0, hop });
      } else {
        const k = stage >= 4 && r > 0.85 ? 'fire' : stage >= 2 && r > 0.7 ? 'trap' : 'rock';
        const d = k === 'rock' ? [22, 18] : k === 'trap' ? [28, 10] : [18, 32];
        objs.push({ t: k, x: W + 20, y: GROUND - d[1], w: d[0], h: d[1], vy: 0, hop: false });
      }
    };

    const update = (dt: number) => {
      t += dt; inv = Math.max(0, inv - dt); shake = Math.max(0, shake - dt * 4);
      const v = speed(); dist += v * dt;
      if (input.consume() && wolf.jumps < 2) { wolf.vy = wolf.jumps === 0 ? -610 : -540; wolf.jumps++; burst(wolf.x + 10, wolf.y + wolf.h, '#c4b5fd', 4); }
      wolf.vy += 1750 * dt; wolf.y += wolf.vy * dt;
      if (wolf.y >= GROUND - wolf.h) { wolf.y = GROUND - wolf.h; wolf.vy = 0; wolf.jumps = 0; }
      nextSpawn -= v * dt;
      if (nextSpawn <= 0) { spawn(); nextSpawn = rand(250, 360) + v * 0.22; }
      const hit = { x: wolf.x + 8, y: wolf.y + 6, w: wolf.w - 14, h: wolf.h - 9 };
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        o.x -= (o.t === 'rabbit' ? v - 70 : v) * dt;
        if (o.hop) { o.vy += 1300 * dt; o.y += o.vy * dt; if (o.y >= GROUND - o.h) { o.y = GROUND - o.h; o.vy = -rand(260, 380); } }
        if (o.x < -50) { objs.splice(i, 1); continue; }
        if (!rectsHit(hit, o)) continue;
        if (o.t === 'rabbit') {
          caught++; objs.splice(i, 1); burst(o.x + 12, o.y + 8, '#fda4af', 10);
          const ns = stageForCaught(caught); if (ns > stage) { stage = ns; cb.stage(stage); }
        } else if (inv <= 0) {
          lives--; inv = 1.3; shake = 1; burst(wolf.x + 24, wolf.y + 16, '#f43f5e', 12); objs.splice(i, 1);
          if (lives <= 0) { stop(); cb.hud({ score: score(), stage, lives: 0 }); cb.over({ score: score(), stage }); return; }
        }
      }
      for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; if (p.life <= 0) puffs.splice(i, 1); }
      hudT -= dt; if (hudT <= 0) { hudT = 0.1; cb.hud({ score: score(), stage, lives }); }
    };

    const pine = (x: number, base: number, h: number, c: string) => { ctx.fillStyle = c; for (let r = 0; r < h / 4; r++) { const w = 4 + r * 4; ctx.fillRect(Math.round(x - w / 2), Math.round(base - h + r * 4), w, 4); } ctx.fillRect(Math.round(x - 2), base - 4, 4, 6); };

    const draw = () => {
      const [a, b] = THEMES[Math.min(stage, THEMES.length) - 1];
      ctx.save(); if (shake > 0) ctx.translate(Math.round(rand(-3, 3) * shake), 0);
      bands(ctx, W, H, a, b, 14);
      ctx.fillStyle = '#fef9c3'; ctx.fillRect(384, 28, 28, 28); ctx.fillRect(388, 24, 20, 4); ctx.fillRect(388, 56, 20, 4); ctx.fillStyle = '#e9e1a8'; ctx.fillRect(392, 34, 6, 6); ctx.fillRect(402, 44, 5, 5);
      ctx.fillStyle = '#fff'; for (let i = 0; i < 30; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i)); ctx.fillRect((i * 83) % W, (i * 37) % 120, 1 + (i % 3 === 0 ? 1 : 0), 1 + (i % 3 === 0 ? 1 : 0)); }
      ctx.globalAlpha = 1;
      const far = (dist * 0.1) % 90, near = (dist * 0.35) % 70;
      for (let x = -90 + (-far); x < W + 90; x += 90) pine(x + 45, GROUND - 30, 70, '#2a1450');
      for (let x = -70 + (-near); x < W + 70; x += 70) pine(x + 25, GROUND, 54, '#150a2a');
      ctx.fillStyle = '#1b0d33'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#7c3aed'; ctx.fillRect(0, GROUND, W, 3); ctx.fillStyle = '#4c1d95'; ctx.fillRect(0, GROUND + 3, W, 3);
      ctx.fillStyle = '#2e1065'; for (let x = -((dist * 1) % 40); x < W; x += 40) ctx.fillRect(Math.round(x), GROUND + 14, 14, 3);
      for (const o of objs) {
        const x = Math.round(o.x), y = Math.round(o.y);
        if (o.t === 'rabbit') sprite(ctx, S.rabbit, x, y, o.w, o.h, true);
        else if (o.t === 'rock') { ctx.fillStyle = '#0b0615'; ctx.fillRect(x, y + 4, o.w, o.h - 4); ctx.fillRect(x + 4, y, o.w - 8, 6); ctx.fillStyle = '#6b7280'; ctx.fillRect(x + 2, y + 6, o.w - 4, o.h - 8); ctx.fillRect(x + 5, y + 2, o.w - 10, 4); ctx.fillStyle = '#9ca3af'; ctx.fillRect(x + 5, y + 3, 6, 2); }
        else if (o.t === 'trap') { ctx.fillStyle = '#94a3b8'; for (let i = 0; i < 4; i++) { ctx.fillRect(x + i * 7, y + 3, 5, 7); ctx.fillRect(x + i * 7 + 1, y, 3, 4); } ctx.fillStyle = '#0b0615'; ctx.fillRect(x, y + 9, o.w, 1); }
        else { const f = Math.floor(t * 10) % 2; ctx.fillStyle = '#f97316'; ctx.fillRect(x + 2, y + 10, 14, 22); ctx.fillRect(x + 5 + f * 2, y + 2, 8, 12); ctx.fillStyle = '#fde047'; ctx.fillRect(x + 6, y + 16, 6, 16); ctx.fillRect(x + 7, y + 8 + f * 2, 4, 8); }
      }
      if (inv <= 0 || Math.floor(t * 14) % 2 === 0) {
        const bob = wolf.y >= GROUND - wolf.h - 0.5 ? Math.abs(Math.sin(t * 14)) * -3 : 0;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(wolf.x + 6, GROUND - 2, wolf.w - 8, 4);
        sprite(ctx, S.wolf, wolf.x, wolf.y + bob, wolf.w, wolf.h);
      }
      for (const p of puffs) { ctx.fillStyle = p.c; ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); }
      ctx.globalAlpha = 1; ctx.restore();
    };

    const stop = runLoop(update, draw);
    return () => { stop(); input.destroy(); };
  },
};
