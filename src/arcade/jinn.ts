import { bands, clamp, createInput, rand, rectsHit, runLoop, sprite } from './engine';
import { isBossWave, waveSize } from './rules';
import type { GameDef, Upgrade } from './types';

const W = 320, H = 480;
interface Jinn { x: number; y: number; hp: number; max: number; boss: boolean; w: number; h: number; hit: number }
interface Bolt { x: number; y: number; vx: number; vy: number; life: number }
interface Puff { x: number; y: number; vx: number; vy: number; life: number; c: string }

const UPGRADES: Upgrade[] = [
  { id: 'speed', icon: '👟', title: 'پای سبک', desc: 'سرعت گرگ ۱۵٪ بیشتر' },
  { id: 'rate', icon: '⚡', title: 'زوزهٔ سریع', desc: 'شلیک ۲۰٪ سریع‌تر' },
  { id: 'multi', icon: '✨', title: 'زوزهٔ دوتایی', desc: 'یک گلوله اضافه در هر شلیک' },
  { id: 'power', icon: '💥', title: 'زوزهٔ قوی', desc: 'آسیب هر گلوله +۱' },
  { id: 'heart', icon: '❤️', title: 'قلب اضافه', desc: 'یک جان بیشتر (حداکثر ۵)' },
];

/** Jinn hunt (survivor style): move, the wolf howls bolts at the nearest jinn automatically. Each wave ends with an upgrade pick; every 5th wave has a giant jinn. */
export const jinn: GameDef = {
  id: 'jinn', title: 'شکار جن', icon: '👻', unlock: 3, w: W, h: H,
  blurb: 'موج‌های جن از همه‌سو می‌آیند. بدو، گرگ خودش شلیک می‌کند؛ بعد هر موج یک ارتقا انتخاب کن.',
  controls: 'کلید ← ↑ → ↓ یا کشیدن انگشت/ماوس',
  start(canvas, S, cb, opts) {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    const input = createInput(canvas, W, H);
    const me = { x: W / 2 - 16, y: H / 2, w: 32, h: 22, face: 1, speed: 120, rate: 0.9, multi: 1, power: 1 };
    const jinns: Jinn[] = [], bolts: Bolt[] = [], puffs: Puff[] = [];
    let lives = opts.lives, wave = 1, toSpawn = waveSize(1), spawnT = 0.6, fireT = 0.4, inv = 0, kills = 0, t = 0, hudT = 0, paused = false, waveBonus = 0;
    const tombs = Array.from({ length: 14 }, () => ({ x: rand(8, W - 20), y: rand(20, H - 30), k: Math.floor(rand(0, 3)) }));
    const score = () => kills * 10 + waveBonus;
    const burst = (x: number, y: number, c: string, n = 8) => { for (let i = 0; i < n; i++) puffs.push({ x, y, vx: rand(-80, 80), vy: rand(-80, 80), life: rand(0.25, 0.6), c }); };

    const spawnOne = (boss: boolean) => {
      const side = Math.floor(rand(0, 4)), w = boss ? 40 : 18, h = boss ? 75 : 34;
      const x = side === 0 ? -w : side === 1 ? W + w : rand(0, W), y = side === 2 ? -h : side === 3 ? H + h : rand(0, H);
      const hp = boss ? 18 + wave * 2 : 1 + Math.floor(wave / 3);
      jinns.push({ x, y, hp, max: hp, boss, w, h, hit: 0 });
    };

    const nextWave = () => {
      wave++; waveBonus += 50; toSpawn = waveSize(wave); spawnT = 0.8; cb.stage(wave);
      if (isBossWave(wave)) spawnOne(true);
    };

    const offer = () => {
      paused = true;
      const pool = UPGRADES.filter(u => u.id !== 'heart' || lives < 5);
      const opts3 = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
      cb.upgrade?.(opts3, (i) => {
        const u = opts3[i];
        if (u.id === 'speed') me.speed *= 1.15; else if (u.id === 'rate') me.rate *= 0.8;
        else if (u.id === 'multi') me.multi = Math.min(4, me.multi + 1); else if (u.id === 'power') me.power += 1;
        else if (u.id === 'heart') lives = Math.min(5, lives + 1);
        inv = 1; paused = false; nextWave();
      });
      if (!cb.upgrade) { paused = false; nextWave(); }
    };

    const update = (dt: number) => {
      if (paused) return;
      t += dt; inv = Math.max(0, inv - dt);
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (input.pointer) { const ex = input.pointer.x - (me.x + me.w / 2), ey = input.pointer.y - (me.y + me.h / 2), d = Math.hypot(ex, ey); if (d > 8) { dx = ex / d; dy = ey / d; } }
      const m = Math.hypot(dx, dy) || 1;
      me.x = clamp(me.x + (dx / m) * me.speed * dt * (dx || dy ? 1 : 0), 0, W - me.w);
      me.y = clamp(me.y + (dy / m) * me.speed * dt * (dx || dy ? 1 : 0), 20, H - me.h);
      if (dx) me.face = dx > 0 ? 1 : -1;

      if (toSpawn > 0) { spawnT -= dt; if (spawnT <= 0) { spawnOne(false); toSpawn--; spawnT = Math.max(0.25, 0.8 - wave * 0.04); } }
      const cx = me.x + me.w / 2, cy = me.y + me.h / 2;
      fireT -= dt;
      if (fireT <= 0 && jinns.length) {
        let best: Jinn | null = null, bd = 1e9;
        for (const j of jinns) { const d = Math.hypot(j.x + j.w / 2 - cx, j.y + j.h / 2 - cy); if (d < bd) { bd = d; best = j; } }
        if (best) {
          const a0 = Math.atan2(best.y + best.h / 2 - cy, best.x + best.w / 2 - cx);
          for (let i = 0; i < me.multi; i++) { const a = a0 + (i - (me.multi - 1) / 2) * 0.22; bolts.push({ x: cx, y: cy, vx: Math.cos(a) * 290, vy: Math.sin(a) * 290, life: 1.6 }); }
          fireT = me.rate;
        }
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        let used = b.life <= 0 || b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10;
        for (const j of jinns) { if (!used && rectsHit({ x: b.x - 3, y: b.y - 3, w: 6, h: 6 }, { x: j.x + 2, y: j.y + 2, w: j.w - 4, h: j.h - 4 })) { j.hp -= me.power; j.hit = 0.1; used = true; burst(b.x, b.y, '#67e8f9', 3); } }
        if (used) bolts.splice(i, 1);
      }
      for (let i = jinns.length - 1; i >= 0; i--) {
        const j = jinns[i]; j.hit = Math.max(0, j.hit - dt);
        const ex = cx - (j.x + j.w / 2), ey = cy - (j.y + j.h / 2), d = Math.hypot(ex, ey) || 1, sp = j.boss ? 22 : 30 + wave * 3;
        j.x += (ex / d) * sp * dt; j.y += (ey / d) * sp * dt;
        if (j.hp <= 0) { jinns.splice(i, 1); kills += j.boss ? 5 : 1; waveBonus += j.boss ? 100 : 0; burst(j.x + j.w / 2, j.y + j.h / 2, '#6ee7b7', j.boss ? 30 : 10); continue; }
        if (inv <= 0 && rectsHit({ x: me.x + 4, y: me.y + 3, w: me.w - 8, h: me.h - 5 }, { x: j.x + 3, y: j.y + 4, w: j.w - 6, h: j.h - 8 })) {
          lives--; inv = 1.1; burst(cx, cy, '#f43f5e', 12);
          if (!j.boss) jinns.splice(i, 1);
          if (lives <= 0) { stop(); cb.hud({ score: score(), stage: wave, lives: 0 }); cb.over({ score: score(), stage: wave }); return; }
        }
      }
      for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) puffs.splice(i, 1); }
      if (toSpawn === 0 && jinns.length === 0) offer();
      hudT -= dt; if (hudT <= 0) { hudT = 0.1; cb.hud({ score: score(), stage: wave, lives }); }
    };

    const draw = () => {
      bands(ctx, W, H, '#0b0615', '#1a0d33', 8);
      ctx.fillStyle = 'rgba(124,58,237,.10)'; for (let y = 0; y < H; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < W; x += 32) ctx.fillRect(x, y, 16, 16);
      for (const g of tombs) { ctx.fillStyle = '#2a1450'; ctx.fillRect(g.x, g.y + 4, 12, 12); ctx.fillRect(g.x + 2, g.y, 8, 6); ctx.fillStyle = '#4c1d95'; ctx.fillRect(g.x + 5, g.y + 6, 2, 7); ctx.fillRect(g.x + 3, g.y + 8, 6, 2); }
      for (const j of jinns) {
        ctx.globalAlpha = j.hit > 0 ? 0.45 : 0.92 + 0.08 * Math.sin(t * 6 + j.x);
        sprite(ctx, S.ghost, j.x, j.y + Math.sin(t * 3 + j.y) * 2, j.w, j.h, (cx0 => cx0 < j.x + j.w / 2)(me.x + me.w / 2));
        ctx.globalAlpha = 1;
        if (j.boss) { ctx.fillStyle = '#0b0615'; ctx.fillRect(j.x - 1, j.y - 9, j.w + 2, 6); ctx.fillStyle = '#f43f5e'; ctx.fillRect(j.x, j.y - 8, Math.max(0, (j.w * j.hp) / j.max), 4); }
      }
      if (inv <= 0 || Math.floor(t * 14) % 2 === 0) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(me.x + 4, me.y + me.h - 2, me.w - 8, 3); sprite(ctx, S.wolf, me.x, me.y, me.w, me.h, me.face < 0 ? true : false); }
      for (const b of bolts) { ctx.fillStyle = '#a5f3fc'; ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 5, 5); ctx.fillStyle = '#22d3ee'; ctx.fillRect(Math.round(b.x - b.vx * 0.02) - 1, Math.round(b.y - b.vy * 0.02) - 1, 3, 3); }
      for (const p of puffs) { ctx.fillStyle = p.c; ctx.globalAlpha = clamp(p.life * 2.5, 0, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); }
      ctx.globalAlpha = 1;
    };

    const stop = runLoop(update, draw);
    return () => { stop(); input.destroy(); };
  },
};
