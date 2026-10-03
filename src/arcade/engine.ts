/** Tiny helpers shared by the pixel games: sprite loading, input, main loop. */
export interface Sprites { wolf: HTMLImageElement; sleep: HTMLImageElement; ghost: HTMLImageElement; rabbit: HTMLImageElement }

let cache: Promise<Sprites> | null = null;
export function loadSprites(): Promise<Sprites> {
  cache ??= Promise.all(['wolf', 'sleep', 'ghost', 'rabbit'].map(n => new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => { cache = null; rej(new Error(n)); }; i.src = `./pixel/${n}.png`;
  }))).then(([wolf, sleep, ghost, rabbit]) => ({ wolf, sleep, ghost, rabbit }));
  return cache;
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
export function sprite(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, flip = false) {
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
