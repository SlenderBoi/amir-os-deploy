import { Plus } from 'lucide-react';
import { useStore } from '../store';
import { Card, faNum } from '../ui';
import { advance, progressOf, UNIT } from '../services/wishlist';
import { Meter } from '../ui';

/** Dashboard strip: things you're in the middle of (a series, a book, a course) with a one-tap "+1". */
export default function WishStrip({ go }: { go: (page: string) => void }) {
  const { data, setData } = useStore();
  const doing = data.wishes.filter(w => w.status === 'doing').slice(0, 4);
  if (!doing.length) return null;
  return (
    <Card>
      <div className="flex justify-between items-center mb-3"><h3 className="font-bold">الان درگیرشی</h3><button className="text-xs accent" onClick={() => go('wishlist')}>ویش‌لیست</button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        {doing.map(w => {
          const unit = UNIT[w.category];
          return (
            <div key={w.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--panel2)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{w.title}</div>
                <div className="text-[11px] muted mt-0.5">{unit && w.total ? `${unit} ${faNum(w.current ?? 0)} از ${faNum(w.total)}` : `٪${faNum(progressOf(w))}`}</div>
                <div className="mt-2"><Meter value={progressOf(w)} /></div>
              </div>
              {unit && <button className="btn p-2" aria-label={`یک ${unit} جلو`} onClick={() => setData(d => ({ ...d, wishes: d.wishes.map(x => x.id === w.id ? advance(x, 1) : x) }))}><Plus size={16} /></button>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
