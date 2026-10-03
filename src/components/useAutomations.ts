import { useEffect } from 'react';
import { useStore } from '../store';
import { runAutomations } from '../services/automation';

/**
 * Runs the automation engine whenever the data changes and once a minute while the app is open.
 * The ledger makes every pass idempotent, so this can never loop: a pass that fires nothing returns the
 * very same object and React does not re-render.
 */
export function useAutomations() {
  const { data, ready, setData } = useStore();
  const enabled = data.automations.some(a => a.enabled);

  useEffect(() => {
    if (!ready || !enabled) return;
    const pass = () => setData(d => runAutomations(d, new Date()).db);
    pass();
    const t = setInterval(pass, 60_000);
    return () => clearInterval(t);
  }, [ready, enabled, data.tasks, data.habits, data.transactions, data.automations, setData]);
}
