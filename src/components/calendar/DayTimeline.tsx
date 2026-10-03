import { useEffect, useState } from 'react';
import { Card, faNum } from '../../ui';
import { dayBlocks } from '../../services/dayBlocks';
import { localISO } from '../../services/dates';
import { faTime } from '../../services/taskTime';
import { useStore } from '../../store';
import type { Event } from '../../types';

const mm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Hour grid for one day: time blocks and timed tasks drawn as boxes (tasks last as long as their estimate, 30 min by default). */
export default function DayTimeline({ iso, compact = false, onEditEvent }: { iso: string; compact?: boolean; onEditEvent?: (e: Event) => void }) {
  const { data } = useStore();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const blocks = dayBlocks(data, iso);
  const first = Math.min(6, ...blocks.map(b => Math.floor(b.start / 60))), last = Math.max(22, ...blocks.map(b => Math.min(24, Math.ceil(b.end / 60))));
  const hh = compact ? 26 : 44, top0 = first * 60, total = (last - first) * hh;
  const y = (m: number) => ((m - top0) / 60) * hh;
  const nowMin = now.getHours() * 60 + now.getMinutes(), today = iso === localISO(now);

  return (
    <div className="relative flex" style={{ height: total }} role="list" aria-label={`برنامهٔ ساعتی ${iso}`}>
      {!compact && <div className="w-10 shrink-0 relative text-[10px] muted">{Array.from({ length: last - first + 1 }, (_, i) => <span key={i} className="absolute -translate-y-1/2" style={{ top: i * hh }}>{faNum(first + i)}</span>)}</div>}
      <div className="relative flex-1 border-s" style={{ borderColor: 'var(--border)' }}>
        {Array.from({ length: last - first }, (_, i) => <div key={i} className="absolute inset-x-0 border-t" style={{ top: i * hh, borderColor: 'var(--border)', opacity: 0.6 }} />)}
        {blocks.map(b => {
          const h = Math.max(compact ? 16 : 22, y(b.end) - y(b.start) - 1);
          const style = { top: y(b.start), height: h, insetInlineStart: `${(b.col / b.cols) * 100}%`, width: `calc(${100 / b.cols}% - 2px)`, background: `${b.color}33`, borderInlineStart: `3px solid ${b.color}` };
          const inner = <><span className={`block truncate ${b.done ? 'line-through opacity-60' : ''}`}>{b.kind === 'task' ? '⏰ ' : ''}{b.title}</span>{!compact && <span className="block text-[10px] opacity-70">{faTime(mm(b.start))} – {faTime(mm(b.end))}</span>}</>;
          return b.event && onEditEvent
            ? <button key={b.id} role="listitem" onClick={() => onEditEvent(b.event!)} className="absolute rounded-md px-1.5 py-0.5 text-[11px] text-start overflow-hidden hover:brightness-125" style={style} title={b.title}>{inner}</button>
            : <div key={b.id} role="listitem" className="absolute rounded-md px-1.5 py-0.5 text-[11px] overflow-hidden" style={style} title={b.title}>{inner}</div>;
        })}
        {today && nowMin >= top0 && nowMin <= last * 60 && <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: y(nowMin) }}><i className="block h-[2px] bg-rose-500" /><i className="absolute -top-[3px] -start-1 w-2 h-2 rounded-full bg-rose-500" /></div>}
        {!blocks.length && !compact && <div className="absolute inset-0 grid place-items-center text-xs muted pointer-events-none">برنامهٔ ساعتی‌ای ثبت نشده</div>}
      </div>
    </div>
  );
}

export function WeekTimeline({ days, label, onEditEvent }: { days: string[]; label: (d: string) => string; onEditEvent: (e: Event) => void }) {
  return (
    <Card className="hidden md:block">
      <h3 className="font-bold text-sm mb-3">نمای ساعتی هفته</h3>
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => <div key={d}><div className="text-[11px] text-center muted mb-1 truncate">{label(d)}</div><DayTimeline iso={d} compact onEditEvent={onEditEvent} /></div>)}
      </div>
    </Card>
  );
}
