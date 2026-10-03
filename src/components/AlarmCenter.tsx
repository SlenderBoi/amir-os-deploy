import { useCallback, useEffect, useRef, useState } from 'react';
import { AlarmClock, BellRing, X } from 'lucide-react';
import { useStore } from '../store';
import { dueRings, faTime, isOpen, leadOf, ringKey, taskAt, whenText } from '../services/taskTime';

/**
 * Rings the alarm for timed tasks while the app is open: a banner at the top, a beep, and (if you
 * allowed it in Settings) a system notification. What already rang is remembered in localStorage so
 * reloading the page never rings the same alarm twice. When the app is closed, only the phone push
 * (ntfy) can wake you — see Settings.
 */
const STORE = 'amir-os-alarms';
interface Memory { fired: string[]; snooze: Record<string, number> }
const readMemory = (): Memory => { try { const m = JSON.parse(localStorage.getItem(STORE) || ''); return { fired: Array.isArray(m.fired) ? m.fired : [], snooze: m.snooze && typeof m.snooze === 'object' ? m.snooze : {} }; } catch { return { fired: [], snooze: {} }; } };
const writeMemory = (m: Memory) => { try { localStorage.setItem(STORE, JSON.stringify({ fired: m.fired.slice(-300), snooze: m.snooze })); } catch { /* storage full or blocked: worst case an alarm rings twice */ } };

let audio: AudioContext | undefined;
export function beep() {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    void audio.resume();
    [0, 0.28, 0.56].forEach(delay => {
      const o = audio!.createOscillator(), g = audio!.createGain(), t = audio!.currentTime + delay;
      o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(audio!.destination); o.start(t); o.stop(t + 0.25);
    });
  } catch { /* browsers block sound until the page has been touched once */ }
}

async function systemNotify(title: string, body: string, tag: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: './icon-192.png', requireInteraction: true });
    else new Notification(title, { body, tag, icon: './icon-192.png' });
  } catch { /* some mobile browsers refuse the constructor; nothing else to try */ }
}

export interface Active { key: string; taskId: string }
/** Test hook: lets the Settings "test alarm" button show a banner without touching task data. */
export const testAlarmEvent = 'amir-os-test-alarm';

export default function AlarmCenter() {
  const { data, ready } = useStore();
  const [active, setActive] = useState<Active[]>([]);
  const [test, setTest] = useState(false);
  const dataRef = useRef(data); dataRef.current = data;

  const ring = useCallback((items: Active[]) => {
    if (!items.length) return;
    setActive(a => [...a, ...items.filter(i => !a.some(x => x.key === i.key))]);
    if (dataRef.current.settings.alarmSound !== false) beep();
    if (dataRef.current.settings.notifications) for (const i of items) {
      const t = dataRef.current.tasks.find(x => x.id === i.taskId); const at = t && taskAt(t);
      if (t && at) void systemNotify(`⏰ ${t.title}`, `${whenText(at, Date.now())} · ساعت ${faTime(t.time!)}`, i.key);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const now = new Date(), mem = readMemory(), d = dataRef.current;
      const rings = dueRings(d, now, new Set(mem.fired));
      const woke = Object.entries(mem.snooze).filter(([, until]) => until <= now.getTime()).map(([key]) => key);
      const items: Active[] = rings.map(r => ({ key: r.key, taskId: r.task.id }));
      for (const key of woke) { delete mem.snooze[key]; const task = d.tasks.find(t => isOpen(t) && ringKey(t, leadOf(d)) === key); if (task) items.push({ key, taskId: task.id }); }
      if (items.length || woke.length) { writeMemory({ ...mem, fired: [...mem.fired, ...rings.map(r => r.key)] }); ring(items); }
    };
    tick();
    const t = setInterval(tick, 15_000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [ready, ring, data.tasks, data.settings.taskLead]);

  useEffect(() => { const h = () => { setTest(true); if (dataRef.current.settings.alarmSound !== false) beep(); }; addEventListener(testAlarmEvent, h); return () => removeEventListener(testAlarmEvent, h); }, []);

  // a banner disappears by itself when its task is finished, deleted or rescheduled
  const shown = active.flatMap(a => { const task = data.tasks.find(t => t.id === a.taskId); return task && isOpen(task) && ringKey(task, leadOf(data)) === a.key ? [{ ...a, task }] : []; });
  const dismiss = (key: string) => setActive(a => a.filter(x => x.key !== key));
  const snooze = (key: string, min: number) => { const m = readMemory(); m.snooze[key] = Date.now() + min * 60_000; writeMemory(m); dismiss(key); };

  if (!shown.length && !test) return null;
  return (
    <div className="fixed top-3 inset-x-3 z-[150] flex flex-col items-center gap-2 pointer-events-none" role="region" aria-label="آلارم کارها">
      {test && (
        <div role="alert" className="pointer-events-auto w-full max-w-md rounded-2xl border p-4 shadow-2xl flex items-center gap-3" style={{ background: 'var(--panel)', borderColor: 'var(--accent)' }}>
          <BellRing className="accent shrink-0" /><div className="flex-1 text-sm">آلارم آزمایشی: اگر این را می‌بینی (و صدا شنیدی)، آلارم کارها هم همین‌طور کار می‌کند.</div>
          <button className="btn !p-1.5" aria-label="بستن" onClick={() => setTest(false)}><X size={14} /></button>
        </div>
      )}
      {shown.map(({ key, task }) => {
        const at = taskAt(task)!;
        return (
          <div key={key} role="alert" data-testid="alarm" className="pointer-events-auto w-full max-w-md rounded-2xl border p-4 shadow-2xl" style={{ background: 'var(--panel)', borderColor: 'var(--accent)' }}>
            <div className="flex items-start gap-3">
              <AlarmClock className="accent shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0"><div className="font-bold truncate">{task.title}</div><div className="text-xs muted mt-0.5">ساعت {faTime(task.time!)} · {whenText(at, Date.now())}</div></div>
              <button className="btn !p-1.5" aria-label="بستن آلارم" onClick={() => dismiss(key)}><X size={14} /></button>
            </div>
            <div className="flex gap-2 mt-3"><button className="btn btn-primary flex-1" onClick={() => dismiss(key)}>باشه</button><button className="btn flex-1" onClick={() => snooze(key, 5)}>۵ دقیقه دیگر</button></div>
          </div>
        );
      })}
    </div>
  );
}
