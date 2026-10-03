import type { DB } from '../types';
import { mergeData, makeBackup, parseBackup } from './backup';

/**
 * Cross-device sync through a PRIVATE GitHub repository owned by the user.
 * The whole state is encrypted in the browser (AES-GCM, key from a random secret) before it is uploaded,
 * so GitHub only ever stores an unreadable blob. Nothing here talks to any other server.
 */
export interface SyncConfig {
  owner: string; repo: string; token: string; secret: string;
  path: string; branch?: string; device: string;
  /** blob sha of the file at the last successful sync, and the matching ETag */
  sha?: string; etag?: string; lastAt?: number;
  /** local data changed since the last sync */
  dirty?: boolean;
}
export const SYNC_KEY = 'amir-os-sync';
export const SYNC_EVENT = 'amir-os-sync-changed';
export const DEFAULT_PATH = 'amir-os-data.enc.json';

export function readSync(): SyncConfig | null {
  try { const c = JSON.parse(localStorage.getItem(SYNC_KEY) ?? 'null'); return c && c.owner && c.repo && c.token && c.secret ? c : null; } catch { return null; }
}
export function writeSync(c: SyncConfig | null, notify = true) {
  if (c) localStorage.setItem(SYNC_KEY, JSON.stringify(c)); else localStorage.removeItem(SYNC_KEY);
  if (notify) dispatchEvent(new Event(SYNC_EVENT));
}
export const patchSync = (p: Partial<SyncConfig>, notify = false) => { const c = readSync(); if (c) writeSync({ ...c, ...p }, notify); };

/* ---------- small helpers ---------- */
const enc = new TextEncoder(), dec = new TextDecoder();
export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export const fromB64 = (b: string): Uint8Array => Uint8Array.from(atob(b.replace(/\s/g, '')), c => c.charCodeAt(0));
const utf8ToB64 = (t: string) => toB64(enc.encode(t));
const b64ToUtf8 = (b: string) => dec.decode(fromB64(b));
const urlSafe = (b: string) => b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromUrlSafe = (b: string) => { const s = b.replace(/-/g, '+').replace(/_/g, '/'); return s + '='.repeat((4 - (s.length % 4)) % 4); };

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
/** 25 random symbols from a 31-letter alphabet ≈ 124 bits. */
export function newSecret(): string {
  const r = crypto.getRandomValues(new Uint8Array(25)); let s = '';
  for (const b of r) s += ALPHABET[b % ALPHABET.length];
  return s.replace(/(.{5})(?=.)/g, '$1-');
}
export const newDeviceId = () => toB64(crypto.getRandomValues(new Uint8Array(6))).replace(/[^a-z0-9]/gi, 'x');

/* ---------- encryption ---------- */
async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret.replace(/-/g, '')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 150_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export interface Envelope { app: 'amir-os-sync'; v: 1; salt: string; iv: string; ct: string; at: string; device: string }

export async function encryptState(db: DB, secret: string, device: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(JSON.stringify(makeBackup(db))));
  const env: Envelope = { app: 'amir-os-sync', v: 1, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct), at: new Date().toISOString(), device };
  return JSON.stringify(env);
}
export function readEnvelope(text: string): Envelope {
  const e = JSON.parse(text);
  if (e?.app !== 'amir-os-sync' || e.v !== 1 || !e.salt || !e.iv || !e.ct) throw new SyncError('format', 'فایل همگام‌سازی در مخزن معتبر نیست.');
  return e;
}
export async function decryptState(text: string, secret: string): Promise<{ db: DB; at: string; device: string }> {
  const e = readEnvelope(text);
  try {
    const key = await deriveKey(secret, fromB64(e.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(e.iv) as BufferSource }, key, fromB64(e.ct) as BufferSource);
    return { db: parseBackup(dec.decode(plain)), at: e.at, device: e.device };
  } catch (err) {
    if (err instanceof SyncError) throw err;
    throw new SyncError('key', 'کلید رمزگشایی درست نیست (یا فایل خراب شده). لینک اتصال را دوباره از دستگاه اول بگیر.');
  }
}

/* ---------- pairing link ---------- */
export interface Pair { o: string; r: string; t: string; k: string; p?: string; b?: string }
export function makePairLink(c: SyncConfig, base: string): string {
  const p: Pair = { o: c.owner, r: c.repo, t: c.token, k: c.secret, ...(c.path !== DEFAULT_PATH ? { p: c.path } : {}), ...(c.branch ? { b: c.branch } : {}) };
  return `${base}#sync=${urlSafe(utf8ToB64(JSON.stringify(p)))}`;
}
export function parsePair(hash: string): Pair | null {
  const m = /[#&]sync=([A-Za-z0-9_-]+)/.exec(hash); if (!m) return null;
  try { const p = JSON.parse(b64ToUtf8(fromUrlSafe(m[1]))); return p?.o && p.r && p.t && p.k ? p : null; } catch { return null; }
}
export const pairToConfig = (p: Pair): SyncConfig => ({ owner: p.o, repo: p.r, token: p.t, secret: p.k, path: p.p || DEFAULT_PATH, branch: p.b, device: newDeviceId() });

/* ---------- GitHub contents API ---------- */
export type SyncErrorKind = 'token' | 'repo' | 'network' | 'conflict' | 'format' | 'key' | 'rate' | 'server';
export class SyncError extends Error { constructor(public kind: SyncErrorKind, message: string) { super(message); } }

const API = 'https://api.github.com';
const headers = (c: SyncConfig, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...extra });
const fileUrl = (c: SyncConfig) => `${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}`;
const refQuery = (c: SyncConfig) => (c.branch ? `?ref=${encodeURIComponent(c.branch)}` : '');

async function call(url: string, init: RequestInit): Promise<Response> {
  try { return await fetch(url, { ...init, cache: 'no-store' }); } catch { throw new SyncError('network', 'اینترنت وصل نیست یا گیت‌هاب در دسترس نیست.'); }
}
function fail(res: Response): never {
  if (res.status === 401) throw new SyncError('token', 'توکن گیت‌هاب نامعتبر یا منقضی شده است.');
  if (res.status === 403 || res.status === 429) throw new SyncError(res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429 ? 'rate' : 'token', res.status === 429 || res.headers.get('x-ratelimit-remaining') === '0' ? 'سقف درخواست گیت‌هاب پر شده؛ کمی بعد دوباره تلاش می‌شود.' : 'توکن اجازهٔ نوشتن در این مخزن را ندارد (باید Contents: Read and write داشته باشد).');
  if (res.status === 409 || res.status === 422) throw new SyncError('conflict', 'فایل در گیت‌هاب تغییر کرده است.');
  throw new SyncError('server', `گیت‌هاب خطا داد (${res.status}).`);
}

export type Remote = { kind: 'none' } | { kind: 'same' } | { kind: 'ok'; sha: string; etag?: string; text: string };

export async function fetchRemote(c: SyncConfig): Promise<Remote> {
  const h = headers(c, c.etag && c.sha ? { 'If-None-Match': c.etag } : {});
  const res = await call(fileUrl(c) + refQuery(c), { headers: h });
  if (res.status === 304) return { kind: 'same' };
  if (res.status === 404) {
    const repo = await call(`${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`, { headers: headers(c) });
    if (repo.status === 404) throw new SyncError('repo', 'مخزن پیدا نشد یا توکن به آن دسترسی ندارد. نام کاربری/نام مخزن و دسترسی توکن را بررسی کن.');
    if (!repo.ok) fail(repo);
    return { kind: 'none' };
  }
  if (!res.ok) fail(res);
  const j = await res.json();
  let text: string;
  if (j.encoding === 'base64' && j.content) text = b64ToUtf8(j.content);
  else { // files over 1 MB come without content: ask for the raw bytes
    const raw = await call(fileUrl(c) + refQuery(c), { headers: headers(c, { Accept: 'application/vnd.github.raw+json' }) });
    if (!raw.ok) fail(raw); text = await raw.text();
  }
  return { kind: 'ok', sha: j.sha, etag: res.headers.get('etag') ?? undefined, text };
}

export async function pushRemote(c: SyncConfig, text: string, sha?: string): Promise<{ sha: string }> {
  const body: Record<string, unknown> = { message: `sync ${new Date().toISOString()} (${c.device})`, content: utf8ToB64(text) };
  if (sha) body.sha = sha; if (c.branch) body.branch = c.branch;
  const res = await call(fileUrl(c), { method: 'PUT', headers: headers(c, { 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
  if (!res.ok) fail(res);
  const j = await res.json();
  return { sha: j.content.sha };
}

/* ---------- decisions & merge ---------- */
export type Plan = 'idle' | 'push' | 'pull' | 'conflict' | 'init-push';
export function plan(o: { hasRemote: boolean; remoteSha?: string; lastSha?: string; dirty: boolean }): Plan {
  if (!o.hasRemote) return 'init-push';
  if (!o.lastSha) return 'conflict'; // first contact with an existing cloud copy: the user decides
  if (o.remoteSha === o.lastSha) return o.dirty ? 'push' : 'idle';
  return o.dirty ? 'conflict' : 'pull';
}

/**
 * Union of two states: records with the same id come from `local`, new ids from either side are kept.
 * Counters (coins spent, best scores, owned items) take the larger / combined value so nothing is lost.
 * Records deleted on one device come back — that is the price of never losing data.
 */
export function mergeStates(local: DB, remote: DB): DB {
  const base = mergeData(remote, local);
  const ls = local.settings, rs = remote.settings;
  const arcade = ls.arcade || rs.arcade ? {
    best: Object.fromEntries([...new Set([...Object.keys(ls.arcade?.best ?? {}), ...Object.keys(rs.arcade?.best ?? {})])].map(k => [k, Math.max(ls.arcade?.best[k] ?? 0, rs.arcade?.best[k] ?? 0)])),
    meatSpent: Math.max(ls.arcade?.meatSpent ?? 0, rs.arcade?.meatSpent ?? 0),
    buffs: Math.max(ls.arcade?.buffs ?? 0, rs.arcade?.buffs ?? 0),
    plays: Math.max(ls.arcade?.plays ?? 0, rs.arcade?.plays ?? 0),
    coins: Math.max(ls.arcade?.coins ?? 0, rs.arcade?.coins ?? 0),
  } : undefined;
  const shop = ls.shop || rs.shop ? {
    ...(rs.shop ?? ls.shop!), ...(ls.shop ?? rs.shop!),
    spent: Math.max(ls.shop?.spent ?? 0, rs.shop?.spent ?? 0),
    owned: [...new Set([...(ls.shop?.owned ?? []), ...(rs.shop?.owned ?? [])])],
  } : undefined;
  const settings = { ...rs, ...ls, ...(arcade ? { arcade } : {}), ...(shop ? { shop } : {}), dismissedAlerts: [...new Set([...(rs.dismissedAlerts ?? []), ...(ls.dismissedAlerts ?? [])])].slice(-150) };
  return { ...base, settings, timer: local.timer ?? remote.timer };
}

/* ---------- safety copy before this device's data gets replaced ---------- */
const BK = 'amir-os-presync';
export async function stashLocal(db: DB): Promise<void> {
  try {
    const open = indexedDB.open(BK, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('copy');
    const idb: IDBDatabase = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
    await new Promise<void>((res, rej) => { const r = idb.transaction('copy', 'readwrite').objectStore('copy').put({ at: new Date().toISOString(), data: db }, 'last'); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
    idb.close();
  } catch { /* best effort */ }
}
export async function readStash(): Promise<{ at: string; data: DB } | null> {
  try {
    const open = indexedDB.open(BK, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('copy');
    const idb: IDBDatabase = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
    const v = await new Promise<{ at: string; data: DB } | undefined>(res => { const r = idb.transaction('copy').objectStore('copy').get('last'); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
    idb.close(); return v ?? null;
  } catch { return null; }
}

/** Is the repository reachable with this token, and is it private? (We refuse public repos.) */
export async function repoInfo(c: SyncConfig): Promise<{ private: boolean; canPush: boolean }> {
  const res = await call(`${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`, { headers: headers(c) });
  if (res.status === 404) throw new SyncError('repo', 'مخزن پیدا نشد یا توکن به آن دسترسی ندارد. نام کاربری/نام مخزن و دسترسی توکن را بررسی کن.');
  if (!res.ok) fail(res);
  const j = await res.json();
  return { private: j.private === true, canPush: j.permissions ? j.permissions.push === true : true };
}
