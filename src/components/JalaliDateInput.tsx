import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAYS_SHORT, faDigits, formatJalali, formatJalaliNumeric, isFriday, monthGrid, monthTitle, parseJalali, shiftMonth, toJalali } from '../services/jalali';
import { isHoliday } from '../services/holidays';
import { localISO } from '../services/dates';
import { useStore } from '../store';

/**
 * Jalali date field: type "1405/07/09" (Persian or English digits) or pick from a month grid.
 * The value going in and out is always an ISO "YYYY-MM-DD" string (or '' when empty), so the data
 * model stays the same as with a native date input.
 */
export default function JalaliDateInput({ value, onChange, className = 'field', ariaLabel }: {
  value: string; onChange: (iso: string) => void; className?: string; ariaLabel?: string;
}) {
  const { data } = useStore();
  const fix = data.settings.holidayFix;
  const [draft, setDraft] = useState(value ? formatJalaliNumeric(value) : '');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => { const j = toJalali(value || localISO()); return { y: j.y, m: j.m }; });
  const typedInvalid = draft.trim() !== '' && !parseJalali(draft);

  useEffect(() => { setDraft(value ? formatJalaliNumeric(value) : ''); }, [value]);

  const type = (text: string) => {
    setDraft(text);
    if (text.trim() === '') { onChange(''); return; }
    const iso = parseJalali(text);
    if (iso) { onChange(iso); const j = toJalali(iso); setCursor({ y: j.y, m: j.m }); }
  };
  const pick = (iso: string) => { onChange(iso); setOpen(false); };
  const today = localISO();
  const grid = open ? monthGrid(cursor.y, cursor.m) : [];

  return (
    <div className="mt-1">
      <div className="flex gap-2">
        <input dir="ltr" inputMode="numeric" className={className.replace('mt-1', '')} style={{ textAlign: 'right' }} value={draft} aria-label={ariaLabel ?? 'تاریخ شمسی'}
          placeholder={faDigits('1405/01/01')} onChange={e => type(e.target.value)}
          onBlur={() => { if (typedInvalid) setDraft(value ? formatJalaliNumeric(value) : ''); }} />
        <button type="button" className="btn p-2 shrink-0" aria-label="باز کردن تقویم" aria-expanded={open} onClick={() => setOpen(o => !o)}><CalendarDays size={18} /></button>
      </div>
      <div className={`text-[11px] mt-1 min-h-4 ${typedInvalid ? 'text-rose-400' : 'muted'}`}>
        {typedInvalid ? 'تاریخ معتبر نیست؛ مثل ۱۴۰۵/۰۷/۰۹ بنویس' : value ? formatJalali(value, { weekday: true }) : ''}
      </div>
      {open && (
        <div className="rounded-xl border p-3 mt-1" style={{ background: 'var(--panel2)', borderColor: 'var(--border)' }} role="dialog" aria-label="انتخاب تاریخ">
          <div className="flex items-center justify-between mb-2">
            <button type="button" className="btn p-1.5" aria-label="ماه قبل" onClick={() => setCursor(c => shiftMonth(c.y, c.m, -1))}><ChevronRight size={16} /></button>
            <b className="text-sm">{monthTitle(cursor.y, cursor.m)}</b>
            <button type="button" className="btn p-1.5" aria-label="ماه بعد" onClick={() => setCursor(c => shiftMonth(c.y, c.m, 1))}><ChevronLeft size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] muted mb-1">{WEEKDAYS_SHORT.map((w, i) => <span key={w} className={i === 6 ? 'text-rose-400' : ''}>{w}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((iso, i) => iso ? (
              <button type="button" key={iso} onClick={() => pick(iso)} aria-label={formatJalali(iso, { weekday: true })} aria-pressed={iso === value}
                className="h-8 rounded-lg text-sm tabular-nums"
                style={iso === value ? { background: 'var(--accent)', color: '#fff' }
                  : { color: isFriday(iso) || isHoliday(iso, fix) ? '#fb7185' : undefined, outline: iso === today ? '1px solid var(--accent)' : undefined }}>
                {faDigits(toJalali(iso).d)}
              </button>
            ) : <span key={`b${i}`} />)}
          </div>
          <div className="flex justify-between mt-2">
            <button type="button" className="btn text-xs py-1" onClick={() => pick(today)}>امروز</button>
            {value && <button type="button" className="btn text-xs py-1" onClick={() => { onChange(''); setOpen(false); }}>پاک کردن</button>}
          </div>
        </div>
      )}
    </div>
  );
}
