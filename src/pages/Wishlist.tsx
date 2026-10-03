import { useMemo, useState } from 'react';
import { Dices, Plus, Search } from 'lucide-react';
import { useStore } from '../store';
import { Card, Empty, Modal, faNum, money } from '../ui';
import WishCard from '../components/wishlist/WishCard';
import WishForm, { blankWish } from '../components/wishlist/WishForm';
import { CATEGORIES, categoryOf, STATUS_FA } from '../components/wishlist/meta';
import { normalize } from '../components/CommandPalette';
import { pickRandom, toggleDone, wishlistStats } from '../services/wishlist';
import type { Priority, WishCategory, WishItem } from '../types';

type StatusFilter = 'open' | 'doing' | 'done' | 'all';
type Sort = 'new' | 'priority' | 'price';
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default function Wishlist() {
  const { data, setData } = useStore();
  const [cat, setCat] = useState<'all' | WishCategory>('all');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [sort, setSort] = useState<Sort>('new');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<WishItem | null>(null);
  const [pick, setPick] = useState<WishItem | undefined>();
  const [picking, setPicking] = useState(false);

  const stats = useMemo(() => wishlistStats(data.wishes), [data.wishes]);
  const needle = normalize(q);
  const list = useMemo(() => data.wishes
    .filter(w => cat === 'all' || w.category === cat)
    .filter(w => status === 'all' || (status === 'open' ? w.status !== 'done' : status === 'doing' ? w.status === 'doing' : w.status === 'done'))
    .filter(w => normalize(`${w.title} ${w.notes} ${w.tags.join(' ')}`).includes(needle))
    .sort((a, b) => sort === 'priority' ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      : sort === 'price' ? (b.price ?? 0) - (a.price ?? 0)
        : b.createdAt.localeCompare(a.createdAt)), [data.wishes, cat, status, sort, needle]);

  const patchWish = (w: WishItem) => setData(d => ({ ...d, wishes: d.wishes.map(x => x.id === w.id ? w : x) }));

  const finish = (w: WishItem) => {
    const priced = w.status !== 'done' && w.category === 'purchase' && !!w.price;
    const record = priced && confirm(`«${w.title}» خریده شد. ${money(w.price ?? 0)} به‌عنوان هزینه در بخش مالی ثبت شود؟`);
    setData(d => toggleDone(d, w.id, !!record));
  };

  const roll = () => { setPick(pickRandom(list.length ? list : data.wishes)); setPicking(true); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">ویش‌لیست</h2>
          <p className="muted text-sm mt-1">خرید، فیلم، سریال، انیمه، دوره، کتاب، بازی و هر تجربه‌ای که می‌خواهی.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={roll} disabled={!data.wishes.some(w => w.status !== 'done' && w.status !== 'dropped')}><Dices size={18} className="accent" />امشب چی؟</button>
          <button className="btn btn-primary" onClick={() => setEdit(blankWish(cat === 'all' ? 'movie' : cat))}><Plus size={18} />افزودن</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="در انتظار" value={faNum(stats.waiting)} />
        <Stat label="در حال انجام" value={faNum(stats.doing)} />
        <Stat label="تمام‌شده این ماه" value={faNum(stats.doneThisMonth)} />
        <Stat label="هزینهٔ خریدهای باقی‌مانده" value={money(stats.remainingCost)} small />
      </div>

      <Card className="p-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1"><Search className="absolute right-3 top-3 muted" size={17} /><input className="field pr-10" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو در ویش‌لیست…" /></div>
          <div className="flex rounded-xl p-1 overflow-auto" style={{ background: 'var(--panel2)' }} role="tablist">
            {([['open', 'فعال'], ['doing', 'در حال انجام'], ['done', 'تمام‌شده'], ['all', 'همه']] as [StatusFilter, string][]).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={status === k} onClick={() => setStatus(k)} className={`btn border-0 whitespace-nowrap text-sm py-1.5 ${status === k ? 'btn-primary' : '!bg-transparent'}`}>{label}</button>
            ))}
          </div>
          <select className="field md:w-40" value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="مرتب‌سازی">
            <option value="new">جدیدترین</option><option value="priority">اولویت</option><option value="price">قیمت</option>
          </select>
        </div>
      </Card>

      <div className="flex gap-2 overflow-auto pb-1">
        <button onClick={() => setCat('all')} className={`btn whitespace-nowrap ${cat === 'all' ? 'btn-primary' : ''}`}>همه <span className="chip">{faNum(data.wishes.length)}</span></button>
        {CATEGORIES.filter(c => data.wishes.some(w => w.category === c.id) || c.id === cat).map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} className={`btn whitespace-nowrap ${cat === c.id ? 'btn-primary' : ''}`}><c.icon size={16} />{c.label}<span className="chip">{faNum(data.wishes.filter(w => w.category === c.id).length)}</span></button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {list.map(w => <WishCard key={w.id} wish={w} onEdit={() => setEdit(w)} onDone={() => finish(w)} onChange={patchWish} highlighted={picking && pick?.id === w.id} />)}
      </div>
      {!list.length && <Empty text={data.wishes.length ? `چیزی با این فیلتر نیست (${STATUS_FA.wanted}ها را در تب «همه» ببین).` : 'هنوز چیزی اضافه نکرده‌ای. یک فیلم، کتاب یا خرید دلخواه اضافه کن.'} />}

      {edit && <WishForm value={edit} close={() => setEdit(null)} />}
      {picking && (
        <Modal title="امشب چی؟" onClose={() => setPicking(false)}>
          {pick ? (
            <div className="text-center">
              <div className="mx-auto max-w-[220px]"><WishCard wish={pick} onEdit={() => { setEdit(pick); setPicking(false); }} onDone={() => { finish(pick); setPicking(false); }} onChange={w => { patchWish(w); setPick(w); }} /></div>
              <p className="text-sm muted mt-4">{categoryOf(pick.category).label} · انتخاب شانسی با وزن اولویت</p>
              <div className="flex justify-center gap-2 mt-4">
                <button className="btn" onClick={roll}><Dices size={16} />یکی دیگه</button>
                {pick.status !== 'doing' && <button className="btn btn-primary" onClick={() => { const w = { ...pick, status: 'doing' as const }; patchWish(w); setPick(w); }}>شروعش می‌کنم</button>}
              </div>
            </div>
          ) : <Empty text="چیزی برای انتخاب نیست." />}
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return <Card><p className="text-xs muted">{label}</p><b className={`block mt-2 ${small ? 'text-base' : 'text-xl'}`}>{value}</b></Card>;
}
