import type { DB } from '../types';
import { planReminders, planSummary } from './reminders';
import { configProblem, ledgerKey, localStore, ntfyConfig, syncNtfy, type SyncResult } from './ntfy';

export interface SyncStatus { at: number; result?: SyncResult; error?: string; planned: number; next: { at: number; title: string } | null }

let status: SyncStatus | null = null;
const listeners = new Set<() => void>();
export const getSyncStatus = () => status;
export const subscribeSync = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const publishStatus = (s: SyncStatus) => { status = s; listeners.forEach(l => l()); };

// one sync at a time, otherwise two overlapping runs could publish the same reminder twice
let chain: Promise<unknown> = Promise.resolve();

export function runSync(getData: () => DB): Promise<SyncStatus | null> {
  const job = chain.then(async () => {
    const db = getData(), cfg = ntfyConfig(db.settings.ntfy);
    if (!cfg.enabled) return null;
    const problem = configProblem(cfg);
    const now = new Date();
    if (problem) { publishStatus({ at: now.getTime(), error: problem, planned: 0, next: null }); return status; }
    const plan = planReminders(db, now, cfg);
    const result = await syncNtfy(cfg, plan, localStore(ledgerKey(cfg)), now.getTime());
    const error = result.failed ? 'ارتباط با سرور ntfy ناموفق بود؛ چند دقیقه دیگر خودکار دوباره تلاش می‌شود.' : result.skipped === 'backoff' ? 'بعد از خطای قبلی منتظر تلاش مجدد است.' : undefined;
    publishStatus({ at: now.getTime(), result, error, planned: plan.length, next: planSummary(plan).next });
    return status;
  });
  chain = job.catch(() => undefined);
  return job;
}
