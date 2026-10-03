import { useEffect, useRef, useState } from 'react';
import { bands, clamp, loadSprites, rand, sprite } from '../arcade/engine';
import type { Sprites } from '../arcade/engine';

const W = 240, H = 120, FEET = 104;
const HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
const MEAT = ['..XXXX..', '.XXXXXX.', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..'];
const CROWN = ['X.X.X.X.X', 'XXXXXXXXX', 'XXXXXXXXX'];

interface Props { level: number; glow: string; feedTick: number; onPoke: () => void; label: string }
interface Fx { x: number; y: number; vy: number; life: number; kind: 'heart' | 'z' }

const phaseOf = (h: number) => (h >= 20 || h < 5 ? 'night' : h >= 17 ? 'dusk' : h < 8 ? 'dawn' : 'day');
const SKY = { night: ['#07040f', '#241049'], dusk: ['#2d1450', '#f08a5d'], dawn: ['#3b1d6e', '#f5a3c7'], day: ['#3a57c4', '#a5d8ff'] } as const;

/** The pixel wolf's home: reacts to the real time of day (sleeps at night), walks where you tap, jumps and shows hearts when petted. */
export default function PixelPet({ level, glow, feedTick, onPoke, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const props = useRef({ level, glow, feedTick, onPoke });
  props.current = { level, glow, feedTick, onPoke };
  const [sprites, setSprites] = useState<Sprites | null>(null);
  useEffect(() => { let on = true; loadSprites().then(s => on && setSprites(s)).catch(() => {}); return () => { on = false; }; }, []);

  useEffect(() => {
    const canvas = ref.current; if (!canvas || !sprites) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    const pet = { x: 70, target: 70, face: 1, jy: 0, jv: 0, eat: 0, awakeUntil: 0, wander: rand(2, 5) };
    const fx: Fx[] = []; let meat: { x: number; y: number } | null = null;
    let seenFeed = props.current.feedTick, t = 0, raf = 0, last = performance.now(), alive = true;
    const sleeping = () => { const h = new Date().getHours(); return (h >= 23 || h < 6) && performance.now() > pet.awakeUntil; };
    const spawnHearts = (x: number, y: number, n = 3) => { for (let i = 0; i < n; i++) fx.push({ x: x + rand(-14, 14), y: y + rand(-4, 4), vy: -rand(18, 34), life: rand(0.9, 1.5), kind: 'heart' }); };

    const poke = (px: number, py: number) => {
      const w = sleeping() ? 56 : 80, h = sleeping() ? 31 : 55;
      const x = pet.x, y = FEET - h - pet.jy;
      if (px >= x - 4 && px <= x + w + 4 && py >= y - 8 && py <= y + h + 6) {
        pet.awakeUntil = performance.now() + 15_000;
        if (pet.jy <= 0.5) pet.jv = 150; spawnHearts(pet.x + w / 2, y, 4); props.current.onPoke();
      } else { pet.awakeUntil = Math.max(pet.awakeUntil, performance.now() + 8_000); pet.target = clamp(px - 40, 4, W - 84); }
    };
    const onDown = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); poke(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(pet.x + 30, FEET - 20); } };
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('keydown', onKey);

    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const { glow: gl, level: lv, feedTick: ft } = props.current;
      const hour = new Date().getHours(), ph = phaseOf(hour), night = ph === 'night';
      if (ft !== seenFeed) { seenFeed = ft; pet.awakeUntil = performance.now() + 20_000; meat = { x: pet.x + (pet.face > 0 ? 70 : -4), y: 0 }; }
      // simulate
      const sl = sleeping();
      if (meat) { meat.y += 90 * dt; if (meat.y >= FEET - 8) { meat = null; pet.eat = 1.6; spawnHearts(pet.x + 40, FEET - 50, 6); } }
      if (pet.eat > 0) pet.eat -= dt;
      if (!sl) {
        pet.wander -= dt;
        if (pet.wander <= 0) { pet.target = rand(8, W - 88); pet.wander = rand(4, 9); }
        const d = pet.target - pet.x;
        if (Math.abs(d) > 1.5 && pet.eat <= 0) { pet.x += Math.sign(d) * Math.min(Math.abs(d), 46 * dt); pet.face = d > 0 ? 1 : -1; }
      }
      if (pet.jy > 0 || pet.jv > 0) { pet.jv -= 520 * dt; pet.jy += pet.jv * dt; if (pet.jy <= 0) { pet.jy = 0; pet.jv = 0; } }
      if (sl && Math.random() < dt * 0.6) fx.push({ x: pet.x + 50, y: FEET - 30, vy: -10, life: 2, kind: 'z' });
      for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.life -= dt; f.y += f.vy * dt; if (f.life <= 0) fx.splice(i, 1); }

      // draw sky
      const [a, b] = SKY[ph]; bands(ctx, W, H, a, b, 10);
      if (night) { ctx.fillStyle = '#fff'; for (let i = 0; i < 36; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + i * 1.7)); ctx.fillRect((i * 67) % W, (i * 29) % 70, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1); } ctx.globalAlpha = 1; ctx.fillStyle = '#fef3c7'; ctx.fillRect(184, 14, 22, 22); ctx.fillStyle = a; ctx.fillRect(194, 10, 20, 20); }
      else { const sx = 30 + ((hour + new Date().getMinutes() / 60 - 6) / 14) * 180; ctx.fillStyle = ph === 'dusk' || ph === 'dawn' ? '#fb923c' : '#fde047'; ctx.fillRect(Math.round(sx), ph === 'day' ? 14 : 40, 18, 18); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5; ctx.fillRect(Math.round(20 + ((t * 3) % 240)), 24, 26, 5); ctx.fillRect(Math.round(30 + ((t * 3) % 240)), 20, 14, 5); ctx.globalAlpha = 1; }
      const hill = night ? ['#120826', '#1a0d33'] : ph === 'day' ? ['#4c3a99', '#5b4bb5'] : ['#2a1452', '#3b1d6e'];
      ctx.fillStyle = hill[0]; for (let x = 0; x < W; x += 4) ctx.fillRect(x, 74 - Math.round(Math.sin(x * 0.045) * 9 + Math.sin(x * 0.11) * 4), 4, 60);
      ctx.fillStyle = hill[1]; for (let x = 0; x < W; x += 4) ctx.fillRect(x, 88 - Math.round(Math.sin(x * 0.07 + 2) * 7), 4, 40);
      ctx.fillStyle = '#0d0618'; for (const px of [14, 222]) for (let r = 0; r < 9; r++) ctx.fillRect(px - 2 - r * 2, 48 + r * 5, 5 + r * 4, 5);
      ctx.fillStyle = '#1b0d33'; ctx.fillRect(0, FEET - 6, W, H); ctx.fillStyle = gl; ctx.globalAlpha = 0.85; ctx.fillRect(0, FEET - 6, W, 2); ctx.globalAlpha = 1;
      ctx.fillStyle = '#2e1065'; for (let x = 6; x < W; x += 26) ctx.fillRect(x, FEET + 6 + (x % 3) * 3, 8, 2);
      if (night) { ctx.fillStyle = '#fde047'; for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i * 2)); ctx.fillRect(Math.round(20 + i * 38 + Math.sin(t + i) * 10), Math.round(78 + Math.sin(t * 1.3 + i * 3) * 10), 2, 2); } ctx.globalAlpha = 1; }
      // aura + shadow
      ctx.fillStyle = gl; ctx.globalAlpha = 0.28; const aw = sl ? 54 : 74; ctx.fillRect(Math.round(pet.x + (sl ? 2 : 3)), FEET - 1, aw, 5); ctx.fillRect(Math.round(pet.x + 6), FEET + 4, aw - 12, 2); ctx.globalAlpha = 1;
      // meat
      if (meat) { ctx.fillStyle = '#b91c1c'; MEAT.forEach((r, y) => [...r].forEach((c, x) => c === 'X' && ctx.fillRect(Math.round(meat!.x) + x * 2, Math.round(meat!.y) + y * 2, 2, 2))); ctx.fillStyle = '#fecaca'; ctx.fillRect(Math.round(meat.x) + 4, Math.round(meat.y) + 4, 4, 2); }
      // wolf
      if (sl) { sprite(ctx, sprites.sleep, pet.x, FEET + 4 - 31 + Math.sin(t * 1.6) * 0.6, 56, 31, false); }
      else {
        const walking = Math.abs(pet.target - pet.x) > 1.5 && pet.eat <= 0;
        const bob = walking ? -Math.abs(Math.sin(t * 11)) * 2.2 : Math.sin(t * 2) * 0.8 + (pet.eat > 0 ? -Math.abs(Math.sin(t * 16)) * 2 : 0);
        const y = FEET + 4 - 55 - pet.jy + bob;
        sprite(ctx, sprites.wolf, pet.x, y, 80, 55, pet.face < 0);
        if (lv >= 10) { ctx.fillStyle = '#fde047'; CROWN.forEach((r, yy) => [...r].forEach((c, xx) => c === 'X' && ctx.fillRect(Math.round(pet.face > 0 ? pet.x + 60 + xx * 2 : pet.x + 80 - 60 - 18 + xx * 2), Math.round(y - 2 + yy * 2), 2, 2))); }
      }
      for (const f of fx) {
        ctx.globalAlpha = clamp(f.life, 0, 1);
        if (f.kind === 'heart') { ctx.fillStyle = '#fb7185'; HEART.forEach((r, y) => [...r].forEach((c, x) => c === 'X' && ctx.fillRect(Math.round(f.x) + x * 2, Math.round(f.y) + y * 2, 2, 2))); }
        else { ctx.fillStyle = '#e9d5ff'; ctx.font = 'bold 9px monospace'; ctx.fillText('z', Math.round(f.x), Math.round(f.y)); }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { alive = false; cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('keydown', onKey); };
  }, [sprites]);

  return <canvas ref={ref} tabIndex={0} role="button" aria-label={label} className="w-full block cursor-pointer outline-none focus-visible:ring-2 ring-violet-400" style={{ imageRendering: 'pixelated', aspectRatio: `${W}/${H}`, touchAction: 'manipulation' }} />;
}
