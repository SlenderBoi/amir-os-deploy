/** Tiny helpers shared by the pixel games: sprite loading + skins, accessories, input, main loop. */
export interface Acc { head?: string; face?: string; neck?: string }
export interface Sprites { wolf: CanvasImageSource; sleep: CanvasImageSource; ghost: HTMLImageElement; rabbit: HTMLImageElement; acc?: Acc }

/** Hue shift / saturation / lightness per skin. Cyan eyes and near-black outlines are kept. */
const SKIN_TUNE: Record<string, { dh?: number; sm?: number; lm?: number; lo?: number }> = {
  fire: { dh: 95, sm: 1.15 }, ice: { dh: -70, lo: 0.04 }, forest: { dh: -135 }, pink: { dh: 60, lo: 0.03 },
  shadow: { sm: 0.12, lm: 0.62 }, gold: { dh: 140, sm: 1.1, lo: 0.05 },
};

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

export function recolor(img: HTMLImageElement, skin: string): CanvasImageSource {
  const t = SKIN_TUNE[skin];
  if (!t) return img;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height), px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const [h, s, l] = rgb2hsl(px[i], px[i + 1], px[i + 2]);
    if (h > 165 && h < 205 && s > 0.5 && l > 0.3) continue; // glowing eyes
    if (l < 0.04) continue; // outline
    const [r, g, b] = hsl2rgb(s > 0.1 ? h + (t.dh ?? 0) : h, Math.min(1, s * (t.sm ?? 1)), Math.max(0, Math.min(1, l * (t.lm ?? 1) + (t.lo ?? 0))));
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

const base: { p: Promise<{ wolf: HTMLImageElement; sleep: HTMLImageElement; ghost: HTMLImageElement; rabbit: HTMLImageElement }> | null } = { p: null };
const skins = new Map<string, Sprites>();
export function loadSprites(skin = 'neon'): Promise<Sprites> {
  base.p ??= Promise.all(['wolf', 'sleep', 'ghost', 'rabbit'].map(n => new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => { base.p = null; rej(new Error(n)); }; i.src = `./pixel/${n}.png`;
  }))).then(([wolf, sleep, ghost, rabbit]) => ({ wolf, sleep, ghost, rabbit }));
  return base.p.then(b => {
    let s = skins.get(skin);
    if (!s) { s = { ...b, wolf: recolor(b.wolf, skin), sleep: recolor(b.sleep, skin) }; skins.set(skin, s); }
    return s;
  });
}

/* ---- accessories: pixel rectangles in the 80x55 right-facing wolf sprite's own coordinates ---- */
type R = [string, number, number, number, number];
const ACC: Record<string, R[]> = {
  crown: [['#fde047', 62, 2, 9, 3], ['#fde047', 62, 0, 2, 3], ['#fde047', 66, -1, 2, 4], ['#fde047', 70, 0, 2, 3], ['#b45309', 62, 4, 9, 1], ['#ef4444', 66, 3, 2, 1]],
  halo: [['#fef08a', 62, -7, 10, 1], ['#fde047', 60, -6, 2, 1], ['#fde047', 72, -6, 2, 1], ['#fde047', 60, -5, 2, 1], ['#fde047', 72, -5, 2, 1], ['#facc15', 62, -4, 10, 1]],
  partyhat: [['#f472b6', 66, -9, 2, 2], ['#22d3ee', 65, -7, 4, 2], ['#fde047', 64, -5, 6, 2], ['#f472b6', 63, -3, 8, 2], ['#22d3ee', 62, -1, 10, 2], ['#fff', 66, -11, 2, 2]],
  sunglasses: [['#0b0615', 63, 11, 8, 5], ['#0b0615', 72, 9, 4, 4], ['#0b0615', 70, 11, 3, 1], ['#38bdf8', 64, 12, 2, 1], ['#38bdf8', 73, 10, 1, 1], ['#1e1b4b', 63, 15, 8, 1]],
  monocle: [['#fde047', 64, 11, 6, 1], ['#fde047', 64, 16, 6, 1], ['#fde047', 64, 12, 1, 4], ['#fde047', 69, 12, 1, 4], ['#fde047', 69, 17, 1, 8]],
  scarf: [['#ef4444', 46, 21, 18, 4], ['#b91c1c', 50, 21, 2, 4], ['#b91c1c', 56, 21, 2, 4], ['#ef4444', 50, 25, 5, 9], ['#b91c1c', 50, 28, 5, 2], ['#b91c1c', 50, 32, 5, 2], ['#7f1d1d', 46, 25, 18, 1]],
  bell: [['#0ea5e9', 48, 22, 15, 2], ['#0369a1', 48, 24, 15, 1], ['#fde047', 55, 25, 4, 4], ['#b45309', 56, 28, 2, 1], ['#fff7ad', 56, 26, 1, 1]],
  bowtie: [['#f472b6', 50, 23, 6, 6], ['#f472b6', 58, 23, 6, 6], ['#be185d', 56, 24, 2, 4], ['#ec4899', 52, 24, 3, 4], ['#ec4899', 59, 24, 3, 4]],
};

/** The wolf sprite plus equipped accessories, scaled to w×h (flip = facing left). */
export function drawWolf(ctx: CanvasRenderingContext2D, S: Sprites, x: number, y: number, w: number, h: number, flip = false) {
  sprite(ctx, S.wolf, x, y, w, h, flip);
  const acc = S.acc; if (!acc) return;
  ctx.save();
  ctx.translate(Math.round(x + (flip ? w : 0)), Math.round(y));
  ctx.scale((flip ? -1 : 1) * (w / 80), h / 55);
  for (const id of [acc.neck, acc.face, acc.head]) for (const [c, rx, ry, rw, rh] of (id ? ACC[id] ?? [] : [])) { ctx.fillStyle = c; ctx.fillRect(rx, ry, rw, rh); }
  ctx.restore();
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}
/** Vertical gradient drawn in hard bands (looks pixel-y). */
export function bands(ctx: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string, n = 12) {
  for (let i = 0; i < n; i++) { ctx.fillStyle = mix(top, bottom, i / (n - 1)); ctx.fillRect(0, Math.floor((h / n) * i), w, Math.ceil(h / n) + 1); }
}
export function sprite(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number, flip = false) {
  if (flip) { ctx.save(); ctx.translate(Math.round(x + w), Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); ctx.restore(); }
  else ctx.drawImage(img, Math.round(x), Math.round(y), w, h);
}

export interface Input { left: boolean; right: boolean; up: boolean; down: boolean; held: boolean; pointer: { x: number; y: number } | null; consume(): boolean; destroy(): void }
const KEYS: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };

/** Keyboard + pointer (mouse/touch) input in the game's logical coordinates. `consume()` returns true once per jump/tap press. */
export function createInput(canvas: HTMLCanvasElement, W: number, H: number): Input {
  let pressed = false;
  const st: Input = { left: false, right: false, up: false, down: false, held: false, pointer: null, consume: () => { const p = pressed; pressed = false; return p; }, destroy: () => {} };
  const kd = (e: KeyboardEvent) => {
    const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
    if (k) { if (!st[k] && k === 'up') pressed = true; st[k] = true; e.preventDefault(); }
    if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) pressed = true; e.preventDefault(); }
  };
  const ku = (e: KeyboardEvent) => { const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()]; if (k) st[k] = false; };
  const pos = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  const pd = (e: PointerEvent) => { st.held = true; pressed = true; st.pointer = pos(e); try { canvas.setPointerCapture(e.pointerId); } catch { /* not supported */ } };
  const pm = (e: PointerEvent) => { if (st.held) st.pointer = pos(e); };
  const pu = () => { st.held = false; st.pointer = null; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  canvas.addEventListener('pointerdown', pd); canvas.addEventListener('pointermove', pm); canvas.addEventListener('pointerup', pu); canvas.addEventListener('pointercancel', pu);
  st.destroy = () => { removeEventListener('keydown', kd); removeEventListener('keyup', ku); canvas.removeEventListener('pointerdown', pd); canvas.removeEventListener('pointermove', pm); canvas.removeEventListener('pointerup', pu); canvas.removeEventListener('pointercancel', pu); };
  return st;
}

/** Fixed-timestep-ish loop (dt capped at 50 ms). Returns a stop function. */
export function runLoop(update: (dt: number) => void, draw: () => void): () => void {
  let alive = true, raf = 0, last = performance.now();
  const f = (t: number) => { if (!alive) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; update(dt); draw(); raf = requestAnimationFrame(f); };
  raf = requestAnimationFrame(f);
  return () => { alive = false; cancelAnimationFrame(raf); };
}

export const rectsHit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
