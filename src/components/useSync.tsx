import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import type { DB } from '../types';
import { SYNC_EVENT, SyncError, decryptState, encryptState, fetchRemote, mergeStates, patchSync, plan, pushRemote, readSync, stashLocal, writeSync } from '../services/sync';
import type { SyncConfig } from '../services/sync';

export type Phase = 'off' | 'idle' | 'syncing' | 'error' | 'offline';
export interface Conflict { remote: DB; sha: string; etag?: string; at: string; device: string; first: boolean }
export interface SyncCtl {
  cfg: SyncConfig | null; phase: Phase; error: string | null; lastAt: number | null; conflict: Conflict | null;
  syncNow: () => Promise<void>; resolve: (how: 'local' | 'remote' | 'merge') => Promise<void>; dismissConflict: () => void;
}
const Ctx = createContext<SyncCtl | null>(null);
export const useSyncCtl = () => useContext(Ctx)!;

const PUSH_DELAY = 4000, POLL = 60_000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const { data, setData, ready } = useStore();
  const [cfg, setCfg] = useState<SyncConfig | null>(readSync);
  const [phase, setPhase] = useState<Phase>(() => (readSync() ? 'idle' : 'off'));
  const [error, setError] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState<number | null>(() => readSync()?.lastAt ?? null);
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const dataRef = useRef(data); dataRef.current = data;
  const skip = useRef<DB | null>(null);     // state we just applied from the cloud: not a user change
  const baseline = useRef(false);           // first loaded state seen
  const busy = useRef(false), again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const muted = useRef(false);             // user postponed a conflict: stay quiet until they sync by hand
  const conflictRef = useRef<Conflict | null>(null); conflictRef.current = conflict;

  useEffect(() => { const h = () => { const c = readSync(); setCfg(c); if (!c) { setPhase('off'); setConflict(null); } else setPhase(p => (p === 'off' ? 'idle' : p)); }; addEventListener(SYNC_EVENT, h); return () => removeEventListener(SYNC_EVENT, h); }, []);

  const fail = useCallback((e: unknown) => {
    const err = e instanceof SyncError ? e : new SyncError('server', 'خطای ناشناخته در همگام‌سازی.');
    setPhase(err.kind === 'network' ? 'offline' : 'error'); setError(err.message);
  }, []);
  const done = useCallback((patch: Partial<SyncConfig> = {}) => {
    const at = Date.now(); patchSync({ ...patch, lastAt: at }); setLastAt(at); setPhase('idle'); setError(null);
  }, []);

  const apply = useCallback((db: DB) => { skip.current = db; setData(() => db); }, [setData]);

  const push = useCallback(async (c: SyncConfig, sha: string | undefined, db: DB) => {
    const text = await encryptState(db, c.secret, c.device);
    const r = await pushRemote(c, text, sha);
    // anything the user changed while we were uploading stays dirty
    done({ sha: r.sha, etag: undefined, dirty: dataRef.current !== db });
    if (dataRef.current !== db) schedule();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const run = useCallback(async () => {
    const c = readSync(); if (!c || !ready || conflictRef.current || muted.current) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true; setPhase('syncing');
    try {
      const remote = await fetchRemote(c);
      if (remote.kind === 'same') { const dirty = !!c.dirty; if (dirty) await push(c, c.sha, dataRef.current); else done(); return; }
      const p = plan({ hasRemote: remote.kind === 'ok', remoteSha: remote.kind === 'ok' ? remote.sha : undefined, lastSha: c.sha, dirty: !!c.dirty });
      if (p === 'init-push') await push(c, undefined, dataRef.current);
      else if (remote.kind === 'ok') {
        const r = await decryptState(remote.text, c.secret);
        if (p === 'pull') { apply(r.db); done({ sha: remote.sha, etag: remote.etag, dirty: false }); }
        else if (p === 'push') await push(c, remote.sha, dataRef.current);
        else if (p === 'conflict') { setConflict({ remote: r.db, sha: remote.sha, etag: remote.etag, at: r.at, device: r.device, first: !c.sha }); setPhase('idle'); }
        else done({ etag: remote.etag });
      }
    } catch (e) {
      if (e instanceof SyncError && e.kind === 'conflict') again.current = true; // someone pushed meanwhile: look again
      else fail(e);
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; setTimeout(run, 800); }
    }
  }, [ready, push, apply, done, fail]);
  const runRef = useRef(run); runRef.current = run;

  function schedule() { clearTimeout(timer.current); timer.current = setTimeout(() => runRef.current(), PUSH_DELAY); }

  // track local edits
  useEffect(() => {
    if (!ready) return;
    if (!baseline.current) { baseline.current = true; return; }
    if (skip.current === data) { skip.current = null; return; }
    if (!readSync()) return;
    patchSync({ dirty: true }); schedule();
  }, [data, ready]);

  // start, poll, come back to the tab, regain network
  useEffect(() => {
    if (!cfg || !ready) return;
    runRef.current();
    const poll = setInterval(() => { if (!document.hidden) runRef.current(); }, POLL);
    const vis = () => { if (!document.hidden) runRef.current(); };
    const on = () => runRef.current();
    document.addEventListener('visibilitychange', vis); addEventListener('online', on); addEventListener('focus', on);
    return () => { clearInterval(poll); clearTimeout(timer.current); document.removeEventListener('visibilitychange', vis); removeEventListener('online', on); removeEventListener('focus', on); };
  }, [cfg, ready]);

  const resolve = useCallback(async (how: 'local' | 'remote' | 'merge') => {
    const k = conflictRef.current, c = readSync(); if (!k || !c) return;
    setConflict(null); setPhase('syncing');
    try {
      if (how === 'remote') { await stashLocal(dataRef.current); apply(k.remote); done({ sha: k.sha, etag: k.etag, dirty: false }); }
      else if (how === 'local') { await stashLocal(k.remote); await push(c, k.sha, dataRef.current); }
      else { const merged = mergeStates(dataRef.current, k.remote); await stashLocal(dataRef.current); apply(merged); await push(c, k.sha, merged); }
    } catch (e) { if (e instanceof SyncError && e.kind === 'conflict') runRef.current(); else fail(e); }
  }, [apply, done, fail, push]);

  const syncNow = useCallback(async () => { muted.current = false; clearTimeout(timer.current); await runRef.current(); }, []);
  const value: SyncCtl = { cfg, phase: cfg ? phase : 'off', error, lastAt, conflict, syncNow, resolve, dismissConflict: () => { muted.current = true; setConflict(null); setPhase('idle'); } };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Re-export so pages can write a fresh config and trigger the engine. */
export const saveSyncConfig = (c: SyncConfig | null) => writeSync(c);
