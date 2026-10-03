import { faTime } from '../../services/taskTime';
import { useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Card, faNum } from '../../ui';
import { describeFix, eventsOn, fixKey } from '../../services/holidays';
import { WEEKDAYS, faDigits, formatJalali, HMONTHS, isFriday, toHijri, weekdayIndex } from '../../services/jalali';
import { parseQuickTask, toTask } from '../../services/quickTask';
import { localISO } from '../../services/dates';
import { useStore } from '../../store';
import type { Event } from '../../types';

const gregorian = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
const PRIORITY_COLOR = { urgent: '#f43f5e', high: '#f59e0b', medium: '#8b5cf6', low: '#64748b' } as const;

/** Everything about one day: holidays/occasions, time blocks, tasks due, and quick add. */
export default function DayDetail({ iso, compact = false, onAddEvent, onEditEvent }: {
  iso: string; compact?: boolean; onAddEvent: (iso: string) => void; onEditEvent: (e: Event) => void;
}) {
  const { data, setData } = useStore();
  const [text, setText] = useState('');
  const fix = data.settings.holidayFix ?? {};
  const occasions = eventsOn(iso, fix);
  const friday = isFriday(iso);
  const dayOff = friday || occasions.some(o => o.off);
  const events = data.events.filter(e => e.date === iso).sort((a, b) => a.start.localeCompare(b.start));
  const tasks = data.tasks.filter(t => t.due === iso && t.status !== 'archived').sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  const h = toHijri(iso);

  const nudge = (o: (typeof occasions)[number], delta: number) => setData(d => {
    const key = fixKey(o);
    const next = { ...(d.settings.holidayFix ?? {}) };
    const value = Math.max(-3, Math.min(3, (next[key] ?? 0) + delta));
    if (value === 0) delete next[key]; else next[key] = value;
    return { ...d, settings: { ...d.settings, holidayFix: next } };
  });

  const addTask = () => {
    const parsed = parseQuickTask(text);
    if (!parsed.title) return;
    const task = toTask({ ...parsed, due: parsed.dueImplied ? iso : parsed.due ?? iso });
    setData(d => ({ ...d, tasks: [task, ...d.tasks] }));
    setText('');
  };

  return (
    <Card className={`${compact ? 'p-3 min-h-52' : ''} ${iso === localISO() ? 'ring-1 ring-[var(--accent)]' : ''}`}>
      <div className={compact ? 'text-center mb-3' : 'mb-4'}>
        <b className={`${compact ? 'text-sm' : 'text-lg'} ${dayOff ? 'text-rose-400' : ''}`}>{compact ? WEEKDAYS[weekdayIndex(iso)] : formatJalali(iso, { weekday: true })}</b>
        <div className="text-xs muted mt-1">
          {compact ? formatJalali(iso, { year: false }) : <><bdi dir="ltr">{gregorian(iso)}</bdi> · <bdi>{faDigits(h.d)} {HMONTHS[h.m - 1]} {faDigits(h.y)}</bdi></>}
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        {friday && <div className="chip !text-rose-300">{compact ? 'تعطیل' : 'جمعه · تعطیل آخر هفته'}</div>}
        {occasions.map(o => (
          <div key={`${o.id}${o.baseIso}`} className="rounded-lg p-2 text-xs" style={{ background: o.off ? 'rgba(244,63,94,.1)' : 'var(--panel2)' }}>
            <div className="flex items-start justify-between gap-2">
              <span className={o.off ? 'text-rose-300' : ''}>{o.title}</span>
              {!compact && <span className="chip shrink-0">{o.off ? 'تعطیل' : 'مناسبت'}</span>}
            </div>
            {o.lunar && !compact && (
              <div className="mt-1.5 flex items-center gap-1.5 muted flex-wrap">
                <span>تقریبی؛ بسته به رؤیت هلال</span>
                <button className="btn p-1" aria-label="یک روز عقب‌تر" title="یک روز عقب‌تر" onClick={() => nudge(o, -1)}><Minus size={12} /></button>
                <button className="btn p-1" aria-label="یک روز جلوتر" title="یک روز جلوتر" onClick={() => nudge(o, 1)}><Plus size={12} /></button>
                {o.iso !== o.baseIso && <><span className="text-amber-400">{describeFix(o)}</span><button className="btn p-1" aria-label="بازگرداندن" title="بازگرداندن" onClick={() => nudge(o, -(fix[fixKey(o)] ?? 0))}><RotateCcw size={12} /></button></>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {events.map(e => (
          <button key={e.id} onClick={() => onEditEvent(e)} className="w-full text-right p-2 rounded-lg border-r-2" style={{ background: 'var(--panel2)', borderColor: e.kind === 'personal' ? '#34d399' : e.kind === 'reminder' ? '#f59e0b' : 'var(--accent)' }}>
            <div className="text-xs font-medium">{e.title}</div>
            <div dir="ltr" className="text-[10px] muted text-right mt-1">{e.start} — {e.end}</div>
          </button>
        ))}
        {tasks.map(t => (
          <div key={t.id} className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: 'var(--panel2)', opacity: t.status === 'done' ? 0.55 : 1 }}>
            <i className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[t.priority] }} />
            {t.time && <span className="accent font-bold tabular-nums">⏰ {faTime(t.time)}</span>}<span className={`flex-1 ${t.status === 'done' ? 'line-through' : ''}`}>{t.title}</span>
            {t.estimate > 0 && t.status !== 'done' && <span className="muted">{faNum(t.estimate)}د</span>}
          </div>
        ))}
        {!events.length && !tasks.length && !occasions.length && !friday && <div className="text-xs muted text-center py-3">برنامه‌ای نداری.</div>}
      </div>

      {!compact && (
        <div className="mt-4 space-y-2">
          <button className="btn w-full" onClick={() => onAddEvent(iso)}><Plus size={16} />بلوک زمانی برای این روز</button>
          <div className="flex gap-2">
            <input className="field" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="کار برای این روز… (!فوری #برچسب ~45)" aria-label="کار جدید برای این روز" />
            <button className="btn btn-primary shrink-0" onClick={addTask} disabled={!text.trim()}>ثبت</button>
          </div>
        </div>
      )}
      {compact && <button className="btn w-full mt-3 text-xs py-1.5" onClick={() => onAddEvent(iso)} aria-label="افزودن بلوک زمانی"><Plus size={14} /></button>}
    </Card>
  );
}
