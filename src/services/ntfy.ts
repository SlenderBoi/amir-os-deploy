import type { NtfyConfig } from '../types';
import type { Planned } from './reminders';

/**
 * The only module that talks to an ntfy server.
 *
 * How closed-app phone notifications work without any backend of ours: every reminder due in the next
 * three days is handed to ntfy as a *scheduled* message (At header, 10 s – 3 days). The ntfy phone app
 * is subscribed to the topic, so the phone buzzes even when Amir OS is closed. Opening Amir OS
 * re-syncs and extends the window. Each reminder has a stable X-Sequence-ID so it can be cancelled
 * (DELETE /topic/id) when the task is done / the event moves. Verified against ntfy.sh: CORS allows the
 * browser to publish directly, DELETE cancels a pending message, and cancel + re-publish replaces it.
 */
export const DEFAULT_NTFY: NtfyConfig = {
  enabled: false, server: 'https://ntfy.sh', topic: '', token: '',
  digest: true, digestTime: '08:00', events: true, eventLead: 10, evening: true, eveningTime: '21:00', weeklyReview: true, showTitles: false,
};
export const ntfyConfig = (c?: Partial<NtfyConfig>): NtfyConfig => ({ ...DEFAULT_NTFY, ...c });

export const TOPIC_RE = /^[A-Za-z0-9_-]{6,64}$/;
/** A long random topic is the only "password" on a public ntfy server. */
export function randomTopic(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return 'amir-os-' + [...bytes].map(b => (b % 36).toString(36)).join('');
}
export const normalizeServer = (s: string) => s.trim().replace(/\/+$/, '');
export function configProblem(c: NtfyConfig): string | null {
  try { const u = new URL(normalizeServer(c.server)); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { return 'آدرس سرور معتبر نیست (مثل https://ntfy.sh).'; }
  if (!TOPIC_RE.test(c.topic)) return 'نام تاپیک باید ۶ تا ۶۴ حرف انگلیسی/عدد/خط تیره باشد.';
  return null;
}

/** HTTP headers can't carry Persian directly; ntfy understands RFC 2047 encoded-words. */
export const encodeHeader = (text: string): string => {
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  const bytes = new TextEncoder().encode(text);
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return `=?UTF-8?B?${btoa(bin)}?=`;
};

type Fetch = typeof fetch;
const headersFor = (c: NtfyConfig): Record<string, string> => c.token ? { Authorization: `Bearer ${c.token}` } : {};
const clickUrl = () => typeof location !== 'undefined' && location.protocol === 'https:' ? location.origin + location.pathname : undefined;
const url = (c: NtfyConfig, id?: string) => `${normalizeServer(c.server)}/${c.topic}${id ? `/${encodeURIComponent(id)}` : ''}`;

export async function publish(c: NtfyConfig, p: Planned, f: Fetch = fetch): Promise<boolean> {
  try {
    const click = clickUrl();
    const res = await f(url(c), {
      method: 'POST', body: p.body || ' ',
      headers: {
        ...headersFor(c), 'X-Sequence-ID': p.id, 'At': String(Math.floor(p.at / 1000)), 'Title': encodeHeader(p.title),
        'Priority': String(p.priority), 'Tags': p.tags.join(','), ...(click ? { Click: click } : {}),
      },
    });
    return res.ok;
  } catch { return false; }
}
export async function cancel(c: NtfyConfig, id: string, f: Fetch = fetch): Promise<boolean> {
  try { return (await f(url(c, id), { method: 'DELETE', headers: headersFor(c) })).ok; } catch { return false; }
}
export async function sendTest(c: NtfyConfig, f: Fetch = fetch): Promise<boolean> {
  try {
    return (await f(url(c), {
      method: 'POST', body: 'اگه این پیام روی گوشیت اومد، اعلان‌های Amir OS درست وصل شده‌اند.',
      headers: { ...headersFor(c), Title: encodeHeader('Amir OS · تست اتصال'), Tags: 'white_check_mark', Priority: '3' },
    })).ok;
  } catch { return false; }
}

// ───────── diff + ledger ─────────
export interface LedgerEntry { hash: string; at: number }
export type Ledger = Record<string, LedgerEntry>;

export const hashOf = (p: Planned) => `${p.at}|${p.priority}|${p.title}|${p.body}`;

/** What to cancel and what to (re)publish so the server matches `plan`. Entries already in the past are forgotten. */
export function diffPlan(plan: Planned[], ledger: Ledger, now: number): { cancel: string[]; publish: Planned[]; forget: string[] } {
  const wanted = new Map(plan.map(p => [p.id, p]));
  const cancelIds: string[] = [], forget: string[] = [];
  for (const [id, entry] of Object.entries(ledger)) {
    if (entry.at <= now) { forget.push(id); continue; }
    const w = wanted.get(id);
    if (!w || hashOf(w) !== entry.hash) cancelIds.push(id);
  }
  const publishList = plan.filter(p => !ledger[p.id] || ledger[p.id].at <= now || hashOf(p) !== ledger[p.id].hash);
  return { cancel: cancelIds, publish: publishList, forget };
}

export interface SyncResult { published: number; cancelled: number; failed: number; scheduled: number; skipped?: 'backoff' }
const MAX_OPS = 60;               // ntfy.sh allows a 60-request burst
const BACKOFF_MS = 5 * 60_000;

export interface Store { get(): { ledger: Ledger; retryAt: number }; set(v: { ledger: Ledger; retryAt: number }): void }
export const localStore = (key: string): Store => ({
  get() { try { const v = JSON.parse(localStorage.getItem(key) || ''); return { ledger: v.ledger ?? {}, retryAt: v.retryAt ?? 0 }; } catch { return { ledger: {}, retryAt: 0 }; } },
  set(v) { localStorage.setItem(key, JSON.stringify(v)); },
});
export const ledgerKey = (c: NtfyConfig) => `amir-os-ntfy:${normalizeServer(c.server)}/${c.topic}`;

export async function syncNtfy(c: NtfyConfig, plan: Planned[], store: Store, now = Date.now(), f: Fetch = fetch): Promise<SyncResult> {
  const state = store.get();
  const result: SyncResult = { published: 0, cancelled: 0, failed: 0, scheduled: 0 };
  if (state.retryAt > now) return { ...result, scheduled: Object.keys(state.ledger).length, skipped: 'backoff' };

  const ledger: Ledger = { ...state.ledger };
  const d = diffPlan(plan, ledger, now);
  d.forget.forEach(id => delete ledger[id]);
  let ops = 0, failed = false;

  for (const id of d.cancel) {
    if (ops++ >= MAX_OPS) break;
    if (await cancel(c, id, f)) { delete ledger[id]; result.cancelled++; } else { failed = true; result.failed++; break; }
  }
  if (!failed) for (const p of d.publish) {
    if (ops++ >= MAX_OPS) break;
    // a changed reminder that is still pending was cancelled above (and removed from the ledger), so this is a clean publish
    if (await publish(c, p, f)) { ledger[p.id] = { hash: hashOf(p), at: p.at }; result.published++; } else { failed = true; result.failed++; break; }
  }
  store.set({ ledger, retryAt: failed ? now + BACKOFF_MS : 0 });
  result.scheduled = Object.keys(ledger).length;
  return result;
}

/** Cancel everything this device scheduled (used when turning the feature off). */
export async function cancelAll(c: NtfyConfig, store: Store, now = Date.now(), f: Fetch = fetch): Promise<number> {
  const { ledger } = store.get();
  const rest: Ledger = {}; let n = 0;
  for (const [id, e] of Object.entries(ledger)) {
    if (e.at <= now) continue;
    if (await cancel(c, id, f)) n++; else rest[id] = e;
  }
  store.set({ ledger: rest, retryAt: 0 });
  return n;
}
