import { useMemo } from 'react';
import { localISO } from '../services/dates';
import { addDays } from '../services/srs';
import { faNum } from '../ui';

const LEVELS = [0, 15, 30, 60]; // upper bounds in minutes for levels 1..3; above → level 4
const levelOf = (min: number) => (min <= 0 ? 0 : min <= LEVELS[1] ? 1 : min <= LEVELS[2] ? 2 : min <= LEVELS[3] ? 3 : 4);
const SHADE = ['var(--panel2)', 'color-mix(in srgb,var(--accent) 28%,var(--panel2))', 'color-mix(in srgb,var(--accent) 52%,var(--panel2))', 'color-mix(in srgb,var(--accent) 78%,var(--panel2))', 'var(--accent)'];
const dayFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' });

/** GitHub-style activity grid. Columns are weeks (Saturday first, Iranian week), newest column on the left in RTL. */
export default function Heatmap({ minutes, weeks = 18 }: { minutes: Record<string, number>; weeks?: number }) {
  const cells = useMemo(() => {
    const today = localISO();
    const [y, m, d] = today.split('-').map(Number);
    const sinceSaturday = (new Date(y, m - 1, d).getDay() + 1) % 7; // Sat=0 … Fri=6
    const start = addDays(today, -(sinceSaturday + (weeks - 1) * 7));
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const date = addDays(start, i);
      return { date, min: minutes[date] ?? 0, future: date > today };
    });
  }, [minutes, weeks]);

  return (
    <div style={{ maxWidth: weeks * 22 }}>
      <div className="grid gap-[3px]" style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(7,1fr)' }} role="img" aria-label="نقشهٔ حرارتی روزهای یادگیری">
        {cells.map(c => (
          <i key={c.date} className="block aspect-square rounded-[4px]" style={{ background: SHADE[levelOf(c.min)], opacity: c.future ? 0.15 : 1 }}
            title={`${dayFmt.format(new Date(c.date + 'T12:00:00'))} — ${faNum(c.min)} دقیقه`} />
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[11px] muted">
        <span>کم</span>{SHADE.map((s, i) => <i key={i} className="w-3 h-3 rounded-[3px] block" style={{ background: s }} />)}<span>زیاد</span>
      </div>
    </div>
  );
}
