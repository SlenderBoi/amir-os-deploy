import { useRef, useState } from 'react';
import { ImagePlus, ListTodo, GraduationCap, Trash2, X } from 'lucide-react';
import { useStore, id } from '../../store';
import { Modal } from '../../ui';
import { fileToPoster } from '../../services/image';
import { isSafeCover, toggleDone, UNIT, wishToTrack } from '../../services/wishlist';
import { toTask } from '../../services/quickTask';
import { CATEGORIES, PRIORITY_FA, STATUS_FA } from './meta';
import type { Priority, WishCategory, WishItem, WishStatus } from '../../types';

export const blankWish = (category: WishCategory = 'movie'): WishItem => ({ id: '', title: '', category, status: 'wanted', priority: 'medium', notes: '', progress: 0, tags: [], createdAt: '' });
const num = (v: string) => (v === '' ? undefined : Math.max(0, Number(v)));

export default function WishForm({ value, close }: { value: WishItem; close: () => void }) {
  const { data, setData } = useStore();
  const [x, setX] = useState(value);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const unit = UNIT[x.category];
  const isNew = !x.id;
  const patch = (p: Partial<WishItem>) => setX(prev => ({ ...prev, ...p }));

  const pickFile = async (f?: File) => {
    if (!f) return;
    try { setError(''); patch({ cover: await fileToPoster(f) }); } catch (e) { setError(e instanceof Error ? e.message : 'خطا در پردازش تصویر'); }
  };

  const save = () => {
    if (!x.title.trim()) return;
    const clean: WishItem = { ...x, title: x.title.trim(), cover: x.cover && isSafeCover(x.cover) ? x.cover : undefined, rating: x.status === 'done' ? x.rating : undefined };
    // Finishing a priced purchase through the form uses the same service as the card button, so Finance stays in sync.
    // The question is asked here, once, and never inside a state updater (StrictMode runs updaters twice).
    const nowDone = clean.status === 'done';
    const finishingPurchase = !isNew && value.status !== 'done' && nowDone && clean.category === 'purchase' && !!clean.price && !clean.boughtTransactionId;
    const record = finishingPurchase && confirm(`این خرید (${new Intl.NumberFormat('fa-IR').format(clean.price ?? 0)} ${data.settings.currency}) به‌عنوان هزینه در بخش مالی هم ثبت شود؟`);
    setData(d => {
      const now = new Date().toISOString();
      if (isNew) return { ...d, wishes: [{ ...clean, id: id(), createdAt: now, completedAt: nowDone ? now : undefined }, ...d.wishes] };
      const wishes = d.wishes.map(w => w.id === clean.id ? { ...clean, completedAt: nowDone ? (w.completedAt ?? now) : undefined } : w);
      if (!record) return { ...d, wishes };
      return toggleDone({ ...d, wishes: wishes.map(w => w.id === clean.id ? { ...w, status: 'wanted' as WishStatus } : w) }, clean.id, true);
    });
    close();
  };

  const remove = () => { if (confirm('این مورد حذف شود؟')) { setData(d => ({ ...d, wishes: d.wishes.filter(w => w.id !== x.id) })); close(); } };

  const toLearning = () => {
    const track = wishToTrack(x);
    setData(d => ({ ...d, learning: [track, ...d.learning], wishes: d.wishes.map(w => w.id === x.id ? { ...w, linkedTrackId: track.id, status: w.status === 'wanted' || w.status === 'planned' ? 'doing' : w.status } : w) }));
    patch({ linkedTrackId: track.id });
    setNotice('به مسیرهای یادگیری اضافه شد.');
  };
  const toTaskNow = () => {
    setData(d => ({ ...d, tasks: [{ ...toTask({ title: x.title, priority: x.priority, tags: x.tags, subtasks: [] }), notes: x.notes }, ...d.tasks] }));
    setNotice('به «ورودی» کارها اضافه شد.');
  };

  return (
    <Modal title={isNew ? 'مورد جدید' : 'ویرایش'} onClose={close} wide>
      <div className="grid md:grid-cols-[170px_1fr] gap-5">
        <div>
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border grid place-items-center" style={{ borderColor: 'var(--border)', background: 'var(--panel2)' }}>
            {isSafeCover(x.cover) ? <img src={x.cover} alt="پوستر" className="absolute inset-0 w-full h-full object-cover" /> : <button className="muted text-xs flex flex-col items-center gap-2 p-3" onClick={() => fileRef.current?.click()}><ImagePlus size={30} />افزودن پوستر</button>}
            {isSafeCover(x.cover) && <button className="absolute top-2 left-2 btn p-1.5" onClick={() => patch({ cover: undefined })} aria-label="حذف پوستر"><X size={14} /></button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="btn w-full mt-2 text-xs" onClick={() => fileRef.current?.click()}><ImagePlus size={14} />{x.cover ? 'تغییر تصویر' : 'انتخاب از دستگاه'}</button>
          <input dir="ltr" className="field mt-2 text-left text-xs" placeholder="یا لینک تصویر https://…" value={x.cover?.startsWith('data:') ? '' : x.cover ?? ''} onChange={e => patch({ cover: e.target.value || undefined })} />
          {error && <p className="text-rose-400 text-xs mt-2" role="alert">{error}</p>}
        </div>

        <div className="space-y-3">
          <label className="text-sm block">عنوان<input autoFocus className="field mt-1" value={x.title} onChange={e => patch({ title: e.target.value })} placeholder="مثلاً Solo Leveling" /></label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-sm">نوع<select className="field mt-1" value={x.category} onChange={e => patch({ category: e.target.value as WishCategory })}>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label className="text-sm">وضعیت<select className="field mt-1" value={x.status} onChange={e => patch({ status: e.target.value as WishStatus })}>{(Object.keys(STATUS_FA) as WishStatus[]).map(s => <option key={s} value={s}>{STATUS_FA[s]}</option>)}</select></label>
            <label className="text-sm">اولویت<select className="field mt-1" value={x.priority} onChange={e => patch({ priority: e.target.value as Priority })}>{(Object.keys(PRIORITY_FA) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_FA[p]}</option>)}</select></label>
          </div>

          {unit && (
            <div className="grid grid-cols-3 gap-2 rounded-xl p-3" style={{ background: 'var(--panel2)' }}>
              {(x.category === 'series' || x.category === 'anime') && <label className="text-xs">فصل<input type="number" min={0} className="field mt-1" value={x.season ?? ''} onChange={e => patch({ season: num(e.target.value) })} /></label>}
              <label className="text-xs">{unit} تا الان<input type="number" min={0} className="field mt-1" value={x.current ?? ''} onChange={e => patch({ current: num(e.target.value) })} /></label>
              <label className="text-xs">کل {unit}‌ها<input type="number" min={0} className="field mt-1" value={x.total ?? ''} onChange={e => patch({ total: num(e.target.value) })} /></label>
            </div>
          )}

          {x.category === 'purchase' && (
            <div className="grid grid-cols-2 gap-2 rounded-xl p-3" style={{ background: 'var(--panel2)' }}>
              <label className="text-xs">قیمت ({data.settings.currency})<input type="number" min={0} className="field mt-1" value={x.price ?? ''} onChange={e => patch({ price: num(e.target.value) })} /></label>
              <label className="text-xs">تا الان کنار گذاشته‌ام<input type="number" min={0} className="field mt-1" value={x.saved ?? ''} onChange={e => patch({ saved: num(e.target.value) })} /></label>
            </div>
          )}

          {!unit && x.category !== 'purchase' && x.status === 'doing' && (
            <label className="text-sm block">پیشرفت ٪{new Intl.NumberFormat('fa-IR').format(x.progress)}<input type="range" min={0} max={100} className="w-full mt-2" value={x.progress} onChange={e => patch({ progress: +e.target.value })} /></label>
          )}

          {x.status === 'done' && (
            <div className="text-sm">امتیاز
              <div className="flex gap-1 mt-1">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => patch({ rating: x.rating === n ? undefined : n })} aria-label={`${n} ستاره`} className={`text-2xl leading-none ${(x.rating ?? 0) >= n ? 'text-amber-400' : 'muted opacity-40'}`}>★</button>)}</div>
            </div>
          )}

          <label className="text-sm block">لینک<input dir="ltr" className="field mt-1 text-left" value={x.url || ''} onChange={e => patch({ url: e.target.value || undefined })} placeholder="https://…" /></label>
          <label className="text-sm block">برچسب‌ها (با ویرگول)<input className="field mt-1" value={x.tags.join('،')} onChange={e => patch({ tags: e.target.value.split(/[،,]/).map(s => s.trim()).filter(Boolean) })} /></label>
          <label className="text-sm block">یادداشت<textarea className="field mt-1 min-h-20" value={x.notes} onChange={e => patch({ notes: e.target.value })} /></label>

          {!isNew && (
            <div className="flex flex-wrap gap-2">
              {(x.category === 'course' || x.category === 'book') && !x.linkedTrackId && <button className="btn text-xs" onClick={toLearning}><GraduationCap size={15} className="accent" />افزودن به مسیرهای یادگیری</button>}
              {x.linkedTrackId && <span className="chip">در آکادمی هست ✓</span>}
              <button className="btn text-xs" onClick={toTaskNow}><ListTodo size={15} className="accent" />ساخت کار</button>
            </div>
          )}
          {notice && <p className="text-xs text-emerald-400" role="status">✓ {notice}</p>}
        </div>
      </div>
      <div className="flex justify-between mt-6">
        <button disabled={isNew} className="btn text-rose-400" onClick={remove}><Trash2 size={16} />حذف</button>
        <div className="flex gap-2"><button className="btn" onClick={close}>لغو</button><button className="btn btn-primary" onClick={save} disabled={!x.title.trim()}>ذخیره</button></div>
      </div>
    </Modal>
  );
}
