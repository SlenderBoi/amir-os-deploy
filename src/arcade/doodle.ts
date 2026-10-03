import { bands, clamp, createInput, drawWolf, rand, runLoop } from './engine';
import { stageForHeight } from './rules';
import type { GameDef } from './types';

const W = 320, H = 480;
const THEMES: [string, string][] = [['#150b2e', '#2a1352'], ['#2a1352', '#7c2d8a'], ['#06283d', '#0e7490'], ['#000005', '#0b0b2a'], ['#2a0510', '#9f1239'], ['#2b1a05', '#b45309']];
type Kind = 'n' | 'm' | 'b' | 's';
interface P { x: number; y: number; w: number; kind: Kind; dir: number; broken: boolean; star: boolean }

/** Doodle-jump style climb: the wolf bounces up platforms; further = higher stage (new sky, moving & crumbling platforms). */
export const doodle: GameDef = {
  id: 'doodle', title: 'پرش تا ماه', icon: '🪂', unlock: 1, w: W, h: H,
  blurb: 'روی سکوها بپر و بالا برو؛ هر مرحله آسمان عوض می‌شود و سکوها سخت‌تر.',
  controls: 'کلید ← → یا کشیدن انگشت/ماوس',
  start(canvas, S, cb, opts) {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    const input = createInput(canvas, W, H);
    const wolf = { x: W / 2 - 18, y: H - 90, vx: 0, vy: -600, w: 36, h: 25, face: 1 };
    const plats: P[] = [{ x: W / 2 - 30, y: H - 50, w: 60, kind: 'n', dir: 0, broken: false, star: false }];
    const stars = Array.from({ length: 45 }, () => ({ x: rand(0, W), y: rand(0, H), s: Math.random() < 0.2 ? 2 : 1 }));
    let topY = H - 50, climbed = 0, bonus = 0, stage = 1, lives = opts.lives, flash = 0, hudT = 0, t = 0, squash = 0;

    const add = (y: number, kind: Kind, star = false) => plats.push({ x: rand(4, W - 64), y, w: 56, kind, dir: Math.random() < 0.5 ? -1 : 1, broken: false, star });
    const fill = () => {
      while (topY > -60) {
        topY -= rand(55, Math.min(125, 78 + stage * 9));
        const r = Math.random();
        add(topY, stage >= 2 && r < 0.2 ? 'm' : r > 0.94 ? 's' : 'n', Math.random() < 0.18);
        if (stage >= 3 && Math.random() < 0.3) add(topY + rand(25, 40), 'b'); // crumbling decoys
      }
    };
    fill();
    const score = () => Math.floor(climbed / 10 + bonus);

    const update = (dt: number) => {
      t += dt; flash = Math.max(0, flash - dt * 1.5); squash = Math.max(0, squash - dt * 5);
      let tx = (input.right ? 1 : 0) - (input.left ? 1 : 0), vT = tx * 215;
      if (input.pointer) vT = clamp((input.pointer.x - (wolf.x + wolf.w / 2)) * 5, -235, 235);
      wolf.vx += (vT - wolf.vx) * Math.min(1, dt * 12);
      wolf.x += wolf.vx * dt;
      if (wolf.x < -wolf.w / 2) wolf.x = W - wolf.w / 2;
      if (wolf.x > W - wolf.w / 2) wolf.x = -wolf.w / 2;
      if (Math.abs(wolf.vx) > 8) wolf.face = wolf.vx > 0 ? 1 : -1;

      const prevBottom = wolf.y + wolf.h;
      wolf.vy += 1500 * dt; wolf.y += wolf.vy * dt;
      for (const p of plats) {
        if (p.kind === 'm' && !p.broken) { p.x += p.dir * 55 * dt; if (p.x < 0 || p.x + p.w > W) p.dir *= -1; }
        if (p.broken) p.y += 320 * dt;
        if (p.star && wolf.x + wolf.w > p.x + p.w / 2 - 8 && wolf.x < p.x + p.w / 2 + 8 && wolf.y < p.y - 2 && wolf.y + wolf.h > p.y - 20) { p.star = false; bonus += 25; }
      }
      if (wolf.vy > 0) {
        for (const p of plats) {
          if (p.broken || prevBottom > p.y + 3 || wolf.y + wolf.h < p.y) continue;
          if (wolf.x + wolf.w - 8 > p.x && wolf.x + 8 < p.x + p.w) {
            if (p.kind === 'b') { p.broken = true; continue; }
            wolf.vy = p.kind === 's' ? -1000 : -690; wolf.y = p.y - wolf.h; squash = 1; break;
          }
        }
      }
      const lim = H * 0.42;
      if (wolf.y < lim) {
        const d = lim - wolf.y; wolf.y = lim; climbed += d; topY += d;
        for (const p of plats) p.y += d;
        for (const s of stars) { s.y += d * 0.25; if (s.y > H) { s.y = 0; s.x = rand(0, W); } }
        for (let i = plats.length - 1; i >= 0; i--) if (plats[i].y > H + 30) plats.splice(i, 1);
        fill();
      }
      const ns = stageForHeight(score());
      if (ns > stage) { stage = ns; flash = 1; cb.stage(stage); }
      if (wolf.y > H + 30) {
        if (lives > 1) { lives--; wolf.vy = -1000; wolf.y = H - 40; plats.push({ x: wolf.x - 12, y: H - 14, w: 60, kind: 'n', dir: 0, broken: false, star: false }); }
        else { stop(); cb.hud({ score: score(), stage, lives: 0 }); cb.over({ score: score(), stage }); return; }
      }
      hudT -= dt; if (hudT <= 0) { hudT = 0.1; cb.hud({ score: score(), stage, lives }); }
    };

    const draw = () => {
      const [a, b] = THEMES[Math.min(stage, THEMES.length) - 1];
      bands(ctx, W, H, a, b);
      ctx.fillStyle = '#fff';
      for (const s of stars) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s.x)); ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s); }
      ctx.globalAlpha = 1;
      for (const p of plats) {
        const col = p.kind === 'm' ? ['#38bdf8', '#0ea5e9'] : p.kind === 'b' ? ['#a16207', '#713f12'] : p.kind === 's' ? ['#f472b6', '#be185d'] : ['#a78bfa', '#6d28d9'];
        const x = Math.round(p.x), y = Math.round(p.y);
        ctx.fillStyle = col[1]; ctx.fillRect(x, y + 3, p.w, 6); ctx.fillStyle = col[0]; ctx.fillRect(x, y, p.w, 4);
        ctx.fillStyle = '#0b0615'; ctx.fillRect(x, y + 9, p.w, 2);
        if (p.kind === 'b') { ctx.fillStyle = '#0b0615'; ctx.fillRect(x + 14, y, 2, 6); ctx.fillRect(x + 34, y + 2, 2, 6); }
        if (p.kind === 's') { ctx.fillStyle = '#fde047'; ctx.fillRect(x + p.w / 2 - 6, y - 5, 12, 3); ctx.fillRect(x + p.w / 2 - 4, y - 8, 8, 3); }
        if (p.star) { ctx.fillStyle = '#fde047'; const sx = Math.round(x + p.w / 2), sy = Math.round(y - 14 + Math.sin(t * 5 + x) * 2); ctx.fillRect(sx - 1, sy - 5, 3, 11); ctx.fillRect(sx - 5, sy - 1, 11, 3); ctx.fillRect(sx - 3, sy - 3, 7, 7); }
      }
      const h = wolf.h * (wolf.vy < 0 ? 1.06 : 1) * (squash > 0 ? 0.92 : 1);
      
      drawWolf(ctx, S, wolf.x, wolf.y + wolf.h - h, wolf.w, h, wolf.face < 0);
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
    };

    const stop = runLoop(update, draw);
    return () => { stop(); input.destroy(); };
  },
};
