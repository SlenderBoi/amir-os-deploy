import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bell, BellOff, CheckCheck, Info, X } from 'lucide-react';
import { useStore } from '../store';
import { buildAlerts, pruneDismissed, type Alert, type AlertPage } from '../services/alerts';
import { faNum } from '../ui';

const LEVEL = {
  urgent: { icon: AlertTriangle, color: '#fb7185', label: 'فوری' },
  warn: { icon: AlertTriangle, color: '#f59e0b', label: 'مهم' },
  info: { icon: Info, color: 'var(--accent)', label: 'اطلاع' },
} as const;

/** Bell in the header: a live "needs attention" list. Nothing is stored except which ones you marked read. */
export default function NotificationBell({ go }: { go: (p: AlertPage | 'settings') => void }) {
  const { data, setData } = useStore();
  const [open, setOpen] = useState(false);
  const [showRead, setShowRead] = useState(false);
  const [tick, setTick] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('mousedown', away); addEventListener('keydown', esc);
    return () => { removeEventListener('mousedown', away); removeEventListener('keydown', esc); };
  }, [open]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const alerts = useMemo(() => buildAlerts(data), [data, tick]);
  const read = new Set(data.settings.dismissedAlerts ?? []);
  const unread = alerts.filter(a => !read.has(a.id));
  const list = showRead ? alerts : unread;

  const markRead = (ids: string[]) => setData(d => ({ ...d, settings: { ...d.settings, dismissedAlerts: pruneDismissed([...(d.settings.dismissedAlerts ?? []), ...ids]) } }));
  const openAlert = (a: Alert) => { markRead([a.id]); setOpen(false); go(a.page); };
  const worst = unread.some(a => a.level === 'urgent') ? '#fb7185' : unread.some(a => a.level === 'warn') ? '#f59e0b' : 'var(--accent)';

  return (
    <div className="relative" ref={box}>
      <button className="btn p-2 relative" title="اعلان‌ها" aria-label={`اعلان‌ها${unread.length ? `، ${unread.length} خوانده‌نشده` : ''}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(o => !o)}>
        <Bell size={18} />
        {unread.length > 0 && <span data-testid="bell-count" className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white grid place-items-center" style={{ background: worst }}>{unread.length > 9 ? '+۹' : faNum(unread.length)}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="مرکز اعلان‌ها" className="absolute left-0 top-full mt-2 z-50 w-[min(92vw,380px)] rounded-2xl border shadow-2xl overflow-hidden" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="font-bold text-sm">نیاز به توجه {unread.length > 0 && <span className="muted font-normal">({faNum(unread.length)})</span>}</div>
            <div className="flex gap-1">
              {unread.length > 0 && <button className="btn !py-1 text-xs" onClick={() => markRead(unread.map(a => a.id))}><CheckCheck size={14} />همه خوانده شد</button>}
              <button className="btn !p-1.5" aria-label="بستن" onClick={() => setOpen(false)}><X size={14} /></button>
            </div>
          </div>

          <ul className="max-h-[60vh] overflow-y-auto">
            {list.length === 0 && <li className="p-6 text-center text-sm muted">{alerts.length ? 'همه را خوانده‌ای. ✨' : 'فعلاً چیزی نیاز به توجه ندارد.'}</li>}
            {list.map(a => {
              const L = LEVEL[a.level], isRead = read.has(a.id);
              return (
                <li key={a.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)', opacity: isRead ? 0.55 : 1 }}>
                  <div className="flex items-start gap-2 p-3 hover:bg-white/5">
                    <L.icon size={16} className="mt-1 shrink-0" style={{ color: L.color }} aria-label={L.label} />
                    <button className="flex-1 text-right min-w-0" onClick={() => openAlert(a)}>
                      <span className="block text-sm">{a.title}</span>
                      {a.detail && <span className="block text-xs muted mt-0.5">{a.detail}</span>}
                    </button>
                    {!isRead && <button className="btn !p-1" aria-label="خوانده شد" title="خوانده شد" onClick={() => markRead([a.id])}><X size={13} /></button>}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="p-3 border-t text-xs flex items-center justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
            {alerts.length > unread.length || showRead
              ? <button className="muted underline" onClick={() => setShowRead(s => !s)}>{showRead ? 'فقط خوانده‌نشده‌ها' : `نمایش خوانده‌شده‌ها (${faNum(alerts.length - unread.length)})`}</button>
              : <span />}
            {!data.settings.notifications && <button className="flex items-center gap-1 muted" onClick={() => { setOpen(false); go('settings'); }}><BellOff size={13} />اعلان مرورگر/موبایل خاموش است</button>}
          </div>
        </div>
      )}
    </div>
  );
}
