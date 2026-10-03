import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useStore } from '../store';
import { getSyncStatus, runSync, subscribeSync } from '../services/ntfySync';

export const useSyncStatus = () => useSyncExternalStore(subscribeSync, getSyncStatus);

/**
 * Keeps the phone reminders in step with the data while the app is open: shortly after any relevant edit,
 * when the tab becomes visible again, and every 30 minutes (which also slides the 3-day window forward).
 * Unchanged data costs zero requests (see diffPlan).
 */
export function useNtfySync() {
  const { data, ready } = useStore();
  const latest = useRef(data);
  latest.current = data;
  const enabled = !!data.settings.ntfy?.enabled;
  const watched = [data.tasks, data.events, data.habits, data.learning, data.reviews, data.settings.ntfy, data.settings.holidayFix];

  useEffect(() => {
    if (!ready || !enabled) return;
    const t = window.setTimeout(() => { void runSync(() => latest.current); }, 15_000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled, ...watched]);

  useEffect(() => {
    if (!ready || !enabled) return;
    const tick = () => { if (document.visibilityState === 'visible') void runSync(() => latest.current); };
    const iv = window.setInterval(tick, 30 * 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick); };
  }, [ready, enabled]);
}
