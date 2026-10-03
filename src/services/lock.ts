/**
 * App lock (PIN / password). Honest scope: this keeps people who pick up your phone or computer out of the app.
 * It does NOT encrypt the data stored in the browser. The secret is only kept as a salted PBKDF2 hash in this device's localStorage.
 */
const KEY = 'amir-os-lock';
export const LOCK_EVENT = 'amir-os-lock-changed';
export const LOCK_NOW = 'amir-os-lock-now';
export type LockKind = 'pin' | 'password';
/** idle: 0 = never, -1 = whenever the app is hidden, N = minutes without use */
export interface LockCfg { v: 1; kind: LockKind; salt: string; hash: string; iters: number; idle: number; fails: number; until: number }

export const lockSupported = () => typeof globalThis.crypto?.subtle?.deriveBits === 'function';

export function readLock(): LockCfg | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.v === 1 && v.hash && v.salt ? v : null; } catch { return null; }
}
export function writeLock(cfg: LockCfg | null) {
  if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg)); else localStorage.removeItem(KEY);
  dispatchEvent(new Event(LOCK_EVENT));
}

/** Persian / Arabic digits -> ASCII, so a PIN typed on a Persian keyboard works. */
export const normalizeSecret = (s: string): string => s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export function validateSecret(raw: string, kind: LockKind): string | null {
  const s = normalizeSecret(raw);
  if (kind === 'pin') return /^\d{4,8}$/.test(s) ? null : 'رمز عددی باید ۴ تا ۸ رقم باشد';
  return s.length >= 6 ? null : 'رمز باید دست‌کم ۶ نویسه باشد';
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function deriveHash(secret: string, salt: string, iters: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalizeSecret(secret)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: iters }, key, 256);
  return b64(new Uint8Array(bits));
}

export async function createLock(secret: string, kind: LockKind, idle: number): Promise<LockCfg> {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const iters = 150_000;
  return { v: 1, kind, salt, hash: await deriveHash(secret, salt, iters), iters, idle, fails: 0, until: 0 };
}

export async function verifySecret(cfg: LockCfg, secret: string): Promise<boolean> {
  const h = await deriveHash(secret, cfg.salt, cfg.iters);
  if (h.length !== cfg.hash.length) return false;
  let diff = 0; for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ cfg.hash.charCodeAt(i);
  return diff === 0;
}

/** Wrong guesses: free for the first 4, then 30 s, 1 min, 2 min … capped at 15 min. */
export const lockoutMs = (fails: number): number => (fails < 5 ? 0 : Math.min(15 * 60_000, 30_000 * 2 ** (fails - 5)));

/** Registers a guess; returns the new config (persisted by the caller). */
export function afterAttempt(cfg: LockCfg, ok: boolean, now = Date.now()): LockCfg {
  if (ok) return { ...cfg, fails: 0, until: 0 };
  const fails = cfg.fails + 1;
  return { ...cfg, fails, until: now + lockoutMs(fails) };
}
export const waitLeft = (cfg: LockCfg, now = Date.now()) => Math.max(0, cfg.until - now);

/** Wipes everything this app keeps on the device (used by "forgot my password"). */
export async function wipeEverything(): Promise<void> {
  await new Promise<void>(res => { const r = indexedDB.deleteDatabase('nulvar-core'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  Object.keys(localStorage).filter(k => k.startsWith('amir-os')).forEach(k => localStorage.removeItem(k));
}
