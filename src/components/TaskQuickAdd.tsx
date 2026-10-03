import { Zap } from 'lucide-react';
import { Card, faDate, faNum } from '../ui';
import { faTime } from '../services/taskTime';
import type { ParsedTask } from '../services/quickTask';

const PRIORITY_FA = { low: 'کم', medium: 'متوسط', high: 'زیاد', urgent: 'فوری' } as const;

/** One-line task capture with a live preview of what the parser understood. */
export default function TaskQuickAdd({ value, onChange, parsed, onAdd }: { value: string; onChange: (v: string) => void; parsed: ParsedTask; onAdd: () => void }) {
  const chips = [
    parsed.priority !== 'medium' && `اولویت ${PRIORITY_FA[parsed.priority]}`,
    parsed.due && faDate(parsed.due),
    parsed.time && `⏰ ${faTime(parsed.time)}`,
    parsed.estimate && `${faNum(parsed.estimate)} دقیقه`,
    parsed.subtasks.length > 0 && `${faNum(parsed.subtasks.length)} زیرکار`,
    ...parsed.tags.map(t => `#${t}`),
  ].filter(Boolean) as string[];

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Zap size={18} className="accent shrink-0" />
        <input className="field" value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onAdd()}
          placeholder="کار جدید… مثلاً: ساخت لندینگ > طراحی > کد  !فوری #کار @فردا ^7:30 ~90" aria-label="ثبت سریع کار" />
        <button className="btn btn-primary shrink-0" onClick={onAdd} disabled={!parsed.title}>ثبت</button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2 min-h-6 text-[11px] muted">
        {parsed.title
          ? <>{chips.map(c => <span key={c} className="chip">{c}</span>)}{!chips.length && <span>Enter برای ثبت در «ورودی»</span>}</>
          : <span><b className="accent">!</b>فوری &nbsp;<b className="accent">#</b>برچسب &nbsp;<b className="accent">@</b>فردا &nbsp;<b className="accent">^</b>7:30 &nbsp;<b className="accent">~</b>45 &nbsp;<b className="accent">&gt;</b>زیرکار</span>}
      </div>
    </Card>
  );
}
