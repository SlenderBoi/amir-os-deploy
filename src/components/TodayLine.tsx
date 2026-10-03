import { useStore } from '../store';
import { eventsOn, nextHolidays } from '../services/holidays';
import { diffDays, formatJalali, isFriday } from '../services/jalali';
import { localISO } from '../services/dates';
import { faNum } from '../ui';

/** Dashboard header line: today's Jalali date, today's occasions, and the next day off. */
export default function TodayLine() {
  const { data } = useStore();
  const fix = data.settings.holidayFix ?? {};
  const today = localISO();
  const occ = eventsOn(today, fix);
  const next = nextHolidays(today, 2, fix).find(h => h.iso > today);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="muted">{formatJalali(today, { weekday: true })}</span>
      {isFriday(today) && <span className="chip !text-rose-300">تعطیل آخر هفته</span>}
      {occ.map(o => <span key={o.id} className={`chip ${o.off ? '!text-rose-300' : ''}`}>{o.title}</span>)}
      {next && <span className="chip muted">تعطیلی بعدی: {next.title} · {faNum(diffDays(next.iso, today))} روز دیگر</span>}
    </div>
  );
}
