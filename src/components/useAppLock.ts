import { useCallback, useEffect, useRef, useState } from 'react';
import { LOCK_EVENT, LOCK_NOW, readLock } from '../services/lock';

/** Locked on start when a lock is configured; re-locks on demand, when idle, or when the app is hidden (as configured). */
export function useAppLock() {
  const [cfg, setCfg] = useState(readLock);
  const [locked, setLocked] = useState(() => !!readLock());
  const last = useRef(Date.now());

  useEffect(() => {
    const sync = () => { const c = readLock(); setCfg(c); if (!c) setLocked(false); };
    const now = () => { if (readLock()) setLocked(true); };
    addEventListener(LOCK_EVENT, sync); addEventListener(LOCK_NOW, now);
    return () => { removeEventListener(LOCK_EVENT, sync); removeEventListener(LOCK_NOW, now); };
  }, []);

  useEffect(() => {
    if (!cfg || locked) return;
    const touch = () => { last.current = Date.now(); };
    const evs = ['pointerdown', 'keydown', 'pointermove', 'touchstart', 'scroll'];
    evs.forEach(e => addEventListener(e, touch, { passive: true }));
    const vis = () => { if (document.hidden && cfg.idle === -1) setLocked(true); };
    document.addEventListener('visibilitychange', vis);
    const timer = setInterval(() => { if (cfg.idle > 0 && Date.now() - last.current > cfg.idle * 60_000) setLocked(true); }, 5000);
    last.current = Date.now();
    return () => { evs.forEach(e => removeEventListener(e, touch)); document.removeEventListener('visibilitychange', vis); clearInterval(timer); };
  }, [cfg, locked]);

  return { enabled: !!cfg, locked, lock: useCallback(() => setLocked(true), []), unlock: useCallback(() => { last.current = Date.now(); setLocked(false); }, []) };
}
