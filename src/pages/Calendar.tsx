import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Card, faNum } from '../ui';
import DayDetail from '../components/calendar/DayDetail';
import DayTimeline, { WeekTimeline } from '../components/calendar/DayTimeline';
import EventForm, { blankEvent } from '../components/calendar/EventForm';
import { eventsOn, nextHolidays } from '../services/holidays';
import { JMONTHS, weekdayIndex, WEEKDAYS_SHORT, addDaysISO, diffDays, faDigits, formatJalali, fromJalali, gregorianSpan, isFriday, monthGrid, monthLength, monthTitle, shiftMonth, startOfWeek, toJalali } from '../services/jalali';
import { localISO } from '../services/dates';
import { useStore } from '../store';
import type { Event } from '../types';

type View = 'month' | 'week' | 'day';
const VIEWS: [View, string][] = [['month', 'ماه'], ['week', 'هفته'], ['day', 'روز']];

export default function Calendar() {
  const { data } = useStore();
  const fix = data.settings.holidayFix ?? {};
  const today = localISO();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(today);
  const [edit, setEdit] = useState<Event | null>(null);
  const j = toJalali(cursor);

  const go = (delta: number) => {
    if (view === 'month') {
      const n = shiftMonth(j.y, j.m, delta);
      setCursor(fromJalali(n.y, n.m, Math.min(j.d, monthLength(n.y, n.m))));
    } else setCursor(addDaysISO(cursor, delta * (view === 'week' ? 7 : 1)));
  };
  const jump = (y: number, m: number) => setCursor(fromJalali(y, m, Math.min(j.d, monthLength(y, m))));

  const grid = useMemo(() => monthGrid(j.y, j.m), [j.y, j.m]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(startOfWeek(cursor), i)), [cursor]);
  const upcoming = useMemo(() => nextHolidays(today, 3, fix), [today, fix]);
  const eventDates = useMemo(() => { const m = new Map<string, number>(); data.events.forEach(e => m.set(e.date, (m.get(e.date) ?? 0) + 1)); return m; }, [data.events]);
  const taskDates = useMemo(() => { const m = new Map<string, number>(); data.tasks.forEach(t => t.due && t.status !== 'done' && t.status !== 'archived' && m.set(t.due, (m.get(t.due) ?? 0) + 1)); return m; }, [data.tasks]);

  const subtitle = view === 'month' ? gregorianSpan(j.y, j.m) : view === 'week' ? `${formatJalali(week[0], { year: false })} تا ${formatJalali(week[6])}` : formatJalali(cursor, { weekday: true });
  const addEvent = (iso: string) => setEdit(blankEvent(iso));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{monthTitle(j.y, j.m)}</h1>
          <p className="text-xs muted mt-1" dir={view === 'month' ? 'ltr' : 'rtl'} style={{ textAlign: 'right' }}>{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <button className="btn" onClick={() => go(-1)} aria-label="قبلی"><ChevronRight /></button>
            <button className="btn" onClick={() => setCursor(today)}>امروز</button>
            <button className="btn" onClick={() => go(1)} aria-label="بعدی"><ChevronLeft /></button>
          </div>
          <select className="field !w-auto" value={j.m} onChange={e => jump(j.y, Number(e.target.value))} aria-label="ماه">{JMONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>
          <select className="field !w-auto" value={j.y} onChange={e => jump(Number(e.target.value), j.m)} aria-label="سال">{Array.from({ length: 9 }, (_, i) => j.y - 4 + i).map(y => <option key={y} value={y}>{faDigits(y)}</option>)}</select>
          <div className="flex gap-1" role="tablist">{VIEWS.map(([k, label]) => <button key={k} role="tab" aria-selected={view === k} className={`btn ${view === k ? 'btn-primary' : ''}`} onClick={() => setView(k)}>{label}</button>)}</div>
          <button className="btn btn-primary" onClick={() => addEvent(cursor)}><Plus size={18} />بلوک زمانی</button>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs" aria-label="تعطیلی‌های بعدی">
          {upcoming.map(h => {
            const n = diffDays(h.iso, today);
            return <button key={h.id + h.iso} className="chip !py-1.5" onClick={() => setCursor(h.iso)}>
              <b className="text-rose-300 ml-1">{n === 0 ? 'امروز' : n === 1 ? 'فردا' : `${faNum(n)} روز دیگر`}</b>{h.title} · {formatJalali(h.iso, { year: false })}
            </button>;
          })}
        </div>
      )}

      {view === 'month' && (
        <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
          <Card className="!p-2 md:!p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-xs muted mb-2">{WEEKDAYS_SHORT.map((w, i) => <span key={w} className={i === 6 ? 'text-rose-400' : ''}>{w}</span>)}</div>
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthTitle(j.y, j.m)}>
              {grid.map((iso, i) => {
                if (!iso) return <span key={`b${i}`} />;
                const occ = eventsOn(iso, fix);
                const off = isFriday(iso) || occ.some(o => o.off);
                const ev = eventDates.get(iso) ?? 0, tk = taskDates.get(iso) ?? 0;
                const selected = iso === cursor;
                return (
                  <button key={iso} role="gridcell" aria-label={formatJalali(iso, { weekday: true }) + (occ.length ? ` · ${occ.map(o => o.title).join('، ')}` : '')} aria-selected={selected}
                    onClick={() => setCursor(iso)}
                    className="relative rounded-xl border p-1.5 text-right h-14 md:h-24 flex flex-col"
                    style={{ borderColor: selected ? 'var(--accent)' : 'var(--border)', background: selected ? 'color-mix(in srgb,var(--accent) 16%,transparent)' : 'var(--panel2)', outline: iso === today ? '2px solid var(--accent)' : undefined, outlineOffset: -2 }}>
                    <span className={`text-sm md:text-base font-bold tabular-nums ${off ? 'text-rose-400' : ''}`}>{faDigits(toJalali(iso).d)}</span>
                    <span className="hidden md:block absolute top-1.5 left-2 text-[10px] muted" dir="ltr">{Number(iso.slice(8))}</span>
                    {occ[0] && <span className={`hidden md:block text-[10px] leading-tight truncate mt-auto ${occ[0].off ? 'text-rose-300' : 'muted'}`}>{occ[0].title}</span>}
                    <span className="flex gap-1 mt-auto md:mt-1">
                      {ev > 0 && <i className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" title={`${faNum(ev)} بلوک`} />}
                      {tk > 0 && <i className="w-1.5 h-1.5 rounded-full bg-amber-400" title={`${faNum(tk)} کار`} />}
                      {occ.length > 0 && <i className={`w-1.5 h-1.5 rounded-full ${occ[0].off ? 'bg-rose-400' : 'bg-slate-500'} md:hidden`} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 text-xs muted mt-3 px-1">
              <span className="flex gap-2 items-center"><i className="w-2 h-2 rounded-full bg-[var(--accent)]" />بلوک زمانی</span>
              <span className="flex gap-2 items-center"><i className="w-2 h-2 rounded-full bg-amber-400" />کار با موعد</span>
              <span className="flex gap-2 items-center"><i className="w-2 h-2 rounded-full bg-rose-400" />تعطیل</span>
            </div>
          </Card>
          <DayDetail iso={cursor} onAddEvent={addEvent} onEditEvent={setEdit} />
        </div>
      )}

      {view === 'week' && <WeekTimeline days={week} label={d => `${WEEKDAYS_SHORT[weekdayIndex(d)]} ${faDigits(formatJalali(d, { year: false }))}`} onEditEvent={setEdit} />}
      {view === 'day' && <Card className="max-w-xl"><h3 className="font-bold text-sm mb-3">برنامهٔ ساعتی</h3><DayTimeline iso={cursor} onEditEvent={setEdit} /></Card>}

      {view !== 'month' && (
        <div className={`grid gap-2 ${view === 'week' ? 'grid-cols-1 md:grid-cols-7' : 'max-w-xl'}`}>
          {(view === 'week' ? week : [cursor]).map(d => <DayDetail key={d} iso={d} compact={view === 'week'} onAddEvent={addEvent} onEditEvent={setEdit} />)}
        </div>
      )}

      {view === 'month' && <p className="text-xs muted">تعطیلات ثابت شمسی دقیق‌اند. تعطیلات مذهبی از تقویم قمری محاسبه می‌شوند و بسته به رؤیت هلال ممکن است یک روز با تقویم رسمی فرق کنند؛ روی همان تعطیلی با + / − اصلاحش کن.</p>}
      {edit && <EventForm value={edit} close={() => setEdit(null)} />}
    </div>
  );
}
