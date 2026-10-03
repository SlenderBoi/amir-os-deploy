import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import type { DB } from '../types';
import { planReminders } from './reminders';
import { cancel, cancelAll, diffPlan, encodeHeader, publish, syncNtfy, ntfyConfig, randomTopic, configProblem, TOPIC_RE, type Ledger, type Store } from './ntfy';

const cfg = ntfyConfig({ enabled: true, topic: 'amir-os-testtopic123' });
// Thursday 9 Mehr 1405, 07:00 Tehran-local
const now = new Date('2026-10-01T07:00:00');
const base = (): DB => ({ ...structuredClone(seed), tasks: [], events: [], habits: [], learning: [], wishes: [], reviews: {}, timer: null });
const task = (over: object) => ({ id: 't', title: 'کار', description: '', status: 'todo', priority: 'medium', estimate: 30, actual: 0, tags: [], subtasks: [], notes: '', createdAt: '', updatedAt: '', ...over }) as DB['tasks'][number];
const memory = (): Store & { v: { ledger: Ledger; retryAt: number } } => { const s = { v: { ledger: {} as Ledger, retryAt: 0 }, get() { return s.v; }, set(x: { ledger: Ledger; retryAt: number }) { s.v = x; } }; return s; };

function fakeFetch(failOn?: (method: string, url: string) => boolean) {
  const calls: { method: string; url: string; headers: Record<string, string>; body?: string }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const call = { method: init.method ?? 'GET', url, headers: init.headers as Record<string, string>, body: init.body as string | undefined };
    calls.push(call);
    return { ok: !(failOn?.(call.method, url)) } as Response;
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe('planReminders', () => {
  it('sends nothing when there is nothing to say', () => {
    expect(planReminders(base(), now, cfg).filter(p => p.id.includes('digest'))).toHaveLength(0);
  });
  it('builds a morning digest per day with counts only by default (private)', () => {
    const db = base();
    db.tasks = [task({ id: 'a', title: 'راز شرکت', due: '2026-10-02' }), task({ id: 'b', title: 'دوم', due: '2026-10-02', priority: 'urgent' })];
    const d = planReminders(db, now, cfg).find(p => p.id === 'd2026-10-02-digest')!;
    expect(d.body).toContain('۲ کار');
    expect(d.body).not.toContain('راز شرکت');
    expect(d.priority).toBe(4);
    expect(new Date(d.at).getHours()).toBe(8);
  });
  it('includes titles only when asked', () => {
    const db = base(); db.tasks = [task({ title: 'راز شرکت', due: '2026-10-02' })];
    expect(planReminders(db, now, ntfyConfig({ ...cfg, showTitles: true })).find(p => p.id === 'd2026-10-02-digest')!.body).toContain('راز شرکت');
  });
  it('skips times that already passed and anything beyond the 3-day window', () => {
    const db = base();
    db.tasks = [task({ due: '2026-10-01' }), task({ id: 'x', due: '2026-10-06' })];
    const late = new Date('2026-10-01T09:00:00');           // 08:00 digest already gone
    expect(planReminders(db, late, cfg).some(p => p.id === 'd2026-10-01-digest')).toBe(false);
    expect(planReminders(db, now, cfg).some(p => p.id === 'd2026-10-06-digest')).toBe(false);
  });
  it('overdue tasks and due reviews show up today', () => {
    const db = base(); db.tasks = [task({ due: '2026-09-20' })];
    const d = planReminders(db, now, cfg).find(p => p.id === 'd2026-10-01-digest')!;
    expect(d.body).toContain('۱ کار عقب‌افتاده');
  });
  it('event reminder fires lead-minutes before the start and carries no title when private', () => {
    const db = base(); db.events = [{ id: 'ev1', title: 'جلسه محرمانه', date: '2026-10-01', start: '10:00', end: '11:00', kind: 'work', createdAt: '' }];
    const e = planReminders(db, now, cfg).find(p => p.id === 'e-ev1')!;
    expect(new Date(e.at).getHours() * 60 + new Date(e.at).getMinutes()).toBe(9 * 60 + 50);
    expect(e.title).toBe('بلوک زمانی');
    expect(planReminders(db, now, ntfyConfig({ ...cfg, events: false })).some(p => p.id === 'e-ev1')).toBe(false);
  });
  it('evening nudge only mentions what is actually missing today, and weekly review lands on Friday', () => {
    const db = base(); db.habits = [{ id: 'h', title: 'ورزش', target: 1, unit: '', color: '', entries: { '2026-10-01': 1 } }];
    expect(planReminders(db, now, cfg).some(p => p.id === 'n2026-10-01-evening')).toBe(false);   // all done today
    expect(planReminders(db, now, cfg).some(p => p.id === 'n2026-10-02-evening')).toBe(true);    // tomorrow: generic nudge
    expect(planReminders(db, now, cfg).some(p => p.id === 'w2026-10-02-review')).toBe(true);     // 2 Oct 2026 is a Friday
  });
});

describe('diffPlan / syncNtfy', () => {
  const db = (() => { const d = base(); d.tasks = [task({ due: '2026-10-02' })]; return d; })();

  it('first sync publishes everything; second sync with unchanged data makes ZERO requests', async () => {
    const store = memory(), { f, calls } = fakeFetch();
    const plan = planReminders(db, now, cfg);
    const a = await syncNtfy(cfg, plan, store, now.getTime(), f);
    expect(a.published).toBe(plan.length); expect(a.failed).toBe(0);
    const before = calls.length;
    const b = await syncNtfy(cfg, plan, store, now.getTime(), f);
    expect(calls.length).toBe(before); expect(b.published + b.cancelled).toBe(0);
  });
  it('publish carries sequence id, unix time and an encoded Persian title', async () => {
    const { f, calls } = fakeFetch();
    const p = planReminders(db, now, cfg)[0];
    await publish(cfg, p, f);
    const h = calls[0].headers;
    expect(h['X-Sequence-ID']).toBe(p.id); expect(h.At).toBe(String(Math.floor(p.at / 1000)));
    expect(h.Title).toMatch(/^=\?UTF-8\?B\?/); expect(/^[\x20-\x7e]*$/.test(h.Title)).toBe(true);
    expect(calls[0].url).toBe('https://ntfy.sh/amir-os-testtopic123');
  });
  it('completing a task cancels its digest; a changed digest is cancelled then re-published', async () => {
    const store = memory(), { f, calls } = fakeFetch();
    await syncNtfy(cfg, planReminders(db, now, cfg), store, now.getTime(), f);
    calls.length = 0;
    const changed = base(); changed.tasks = [task({ due: '2026-10-02' }), task({ id: 'u', due: '2026-10-02' })];
    await syncNtfy(cfg, planReminders(changed, now, cfg), store, now.getTime(), f);
    expect(calls.map(c => c.method)).toEqual(['DELETE', 'POST']);
    calls.length = 0;
    await syncNtfy(cfg, planReminders(base(), now, cfg), store, now.getTime(), f);   // all tasks gone
    expect(calls.map(c => c.method)).toEqual(['DELETE']);
    expect(calls[0].url).toContain('/d2026-10-02-digest');
    expect(Object.keys(store.get().ledger).some(id => id.includes('digest'))).toBe(false);
  });
  it('a failure stops the batch, keeps the ledger honest, and backs off for 5 minutes', async () => {
    const store = memory(); const { f, calls } = fakeFetch(m => m === 'POST');
    const r = await syncNtfy(cfg, planReminders(db, now, cfg), store, now.getTime(), f);
    expect(r.failed).toBe(1); expect(Object.keys(store.get().ledger)).toHaveLength(0);
    const n = calls.length;
    const again = await syncNtfy(cfg, planReminders(db, now, cfg), store, now.getTime() + 60_000, f);
    expect(again.skipped).toBe('backoff'); expect(calls.length).toBe(n);
    const later = await syncNtfy(cfg, planReminders(db, now, cfg), store, now.getTime() + 6 * 60_000, fakeFetch().f);
    expect(later.published).toBeGreaterThan(0);
  });
  it('forgets entries that have already been delivered instead of cancelling them', () => {
    const ledger: Ledger = { old: { hash: 'x', at: now.getTime() - 1000 } };
    const d = diffPlan([], ledger, now.getTime());
    expect(d.cancel).toEqual([]); expect(d.forget).toEqual(['old']);
  });
  it('cancelAll cancels only pending reminders', async () => {
    const store = memory(), { f, calls } = fakeFetch();
    store.set({ ledger: { a: { hash: 'h', at: now.getTime() + 5000 }, b: { hash: 'h', at: now.getTime() - 5000 } }, retryAt: 0 });
    expect(await cancelAll(cfg, store, now.getTime(), f)).toBe(1);
    expect(calls).toHaveLength(1); expect(Object.keys(store.get().ledger)).toEqual([]);
    expect(await cancel(cfg, 'z', fakeFetch(() => true).f)).toBe(false);
  });
});

describe('config helpers', () => {
  it('random topics are long, unique and valid', () => {
    const a = randomTopic(), b = randomTopic();
    expect(a).not.toBe(b); expect(TOPIC_RE.test(a)).toBe(true); expect(a.length).toBeGreaterThanOrEqual(24);
  });
  it('validates server and topic', () => {
    expect(configProblem({ ...cfg, topic: 'ab' })).toMatch(/تاپیک/);
    expect(configProblem({ ...cfg, server: 'not a url' })).toMatch(/سرور/);
    expect(configProblem(cfg)).toBeNull();
  });
  it('plain ASCII headers are left alone', () => { expect(encodeHeader('hello')).toBe('hello'); });
});
