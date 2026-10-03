import { Check, Minus, Plus } from 'lucide-react';
import { Card, Meter, faNum, money } from '../../ui';
import { advance, isSafeCover, progressOf, UNIT } from '../../services/wishlist';
import { categoryOf, STATUS_FA } from './meta';
import type { WishItem } from '../../types';

export const Stars = ({ value }: { value?: number }) => value
  ? <span className="text-amber-400 text-xs tracking-tight" aria-label={`امتیاز ${value} از ۵`}>{'★'.repeat(value)}<span className="opacity-30">{'★'.repeat(5 - value)}</span></span>
  : null;

/** One line describing where you are: "فصل ۲ · قسمت ۵ از ۱۰", "۲٬۰۰۰٬۰۰۰ از ۸٬۰۰۰٬۰۰۰ تومان", … */
export function progressLine(w: WishItem): string | null {
  const unit = UNIT[w.category];
  if (unit && w.total) return `${w.season ? `فصل ${faNum(w.season)} · ` : ''}${unit} ${faNum(w.current ?? 0)} از ${faNum(w.total)}`;
  if (unit && w.current) return `${w.season ? `فصل ${faNum(w.season)} · ` : ''}${unit} ${faNum(w.current)}`;
  if (w.category === 'purchase' && w.price) return w.saved ? `${money(w.saved)} از ${money(w.price)}` : money(w.price);
  return null;
}

export default function WishCard({ wish, onEdit, onDone, onChange, highlighted = false }: {
  wish: WishItem; onEdit: () => void; onDone: () => void; onChange: (w: WishItem) => void; highlighted?: boolean;
}) {
  const meta = categoryOf(wish.category);
  const Icon = meta.icon;
  const pct = progressOf(wish);
  const unit = UNIT[wish.category];
  const finished = wish.status === 'done';
  const line = progressLine(wish);

  return (
    <Card className={`!p-0 overflow-hidden group ${finished ? 'opacity-70' : ''} ${highlighted ? 'ring-2 ring-[var(--accent)]' : ''}`}>
      <button onClick={onEdit} className="block w-full text-right relative h-44" aria-label={`جزئیات ${wish.title}`}>
        {isSafeCover(wish.cover)
          ? <img src={wish.cover} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 grid place-items-center" style={{ background: `linear-gradient(135deg,${meta.from},${meta.to})` }}><Icon size={54} className="text-white/25" /></div>}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top,rgba(8,5,14,.92),rgba(8,5,14,.1) 60%)' }} />
        <span className="absolute top-2.5 right-2.5 chip backdrop-blur" style={{ background: 'rgba(0,0,0,.55)', color: '#fff' }}><Icon size={12} className="ml-1" />{meta.label}</span>
        <span className="absolute top-2.5 left-2.5 chip backdrop-blur" style={{ background: finished ? 'rgba(16,185,129,.85)' : 'rgba(0,0,0,.55)', color: '#fff' }}>{STATUS_FA[wish.status]}</span>
        <span className="absolute bottom-2.5 right-3 left-3 text-white">
          <b className={`block truncate text-base ${finished ? 'line-through' : ''}`}>{wish.title}</b>
          <Stars value={wish.rating} />
        </span>
      </button>
      <div className="p-3.5">
        {line && <div className="text-xs muted mb-2 truncate">{line}</div>}
        {(pct > 0 || wish.status === 'doing') && !finished && <Meter value={pct} />}
        <div className="flex items-center gap-2 mt-3">
          {unit && !finished && (
            <>
              <button className="btn flex-1 text-xs py-1.5" onClick={() => onChange(advance(wish, 1))}><Plus size={14} />۱ {unit}</button>
              {(wish.current ?? 0) > 0 && <button className="btn p-2" onClick={() => onChange(advance(wish, -1))} aria-label={`یک ${unit} به عقب`}><Minus size={14} /></button>}
            </>
          )}
          {!unit && <span className="flex-1 flex flex-wrap gap-1">{wish.tags.slice(0, 2).map(t => <span key={t} className="chip">#{t}</span>)}</span>}
          <button onClick={onDone} aria-label={finished ? 'برگرداندن به حالت انجام‌نشده' : 'علامت‌گذاری به‌عنوان انجام‌شده'} title={finished ? 'برگرداندن' : 'انجام شد'}
            className="w-9 h-9 rounded-lg border grid place-items-center shrink-0" style={finished ? { background: '#10b981', borderColor: '#10b981', color: '#fff' } : { borderColor: 'var(--border)' }}>
            <Check size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}
