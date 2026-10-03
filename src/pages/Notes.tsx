import { useState } from 'react';
import { Pin, Plus, Search, Trash2, Zap } from 'lucide-react';
import { useStore, id } from '../store';
import { Card, Empty, Modal } from '../ui';
import { normalize } from '../components/CommandPalette';
import type { Note } from '../types';

/** Capture types. `category` stays a plain string in the DB, so old notes and backups keep working. */
export const NOTE_KINDS = ['ایده', 'ایده پروژه', 'ایده اتوماسیون', 'ایده کسب‌وکار', 'بوکمارک', 'یادداشت یادگیری', 'یادداشت'] as const;

const blank = (category: string = NOTE_KINDS[0]): Note => ({ id: '', title: '', body: '', category, tags: [], pinned: false, createdAt: '', updatedAt: '' });
const splitTags = (v: string) => v.split(/[،,]/).map(s => s.trim()).filter(Boolean);

export default function Notes() {
  const { data, setData } = useStore();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string>('all');
  const [edit, setEdit] = useState<Note | null>(null);
  const [quick, setQuick] = useState('');
  const [quickKind, setQuickKind] = useState<string>(NOTE_KINDS[0]);

  const kinds = [...new Set([...NOTE_KINDS, ...data.notes.map(n => n.category)])];
  const needle = normalize(q);
  const list = data.notes
    .filter(n => kind === 'all' || n.category === kind)
    .filter(n => normalize(`${n.title} ${n.body} ${n.tags.join(' ')}`).includes(needle))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

  /** Fastest capture path: type, press Enter. The first line becomes the title. */
  const capture = () => {
    const text = quick.trim();
    if (!text) return;
    const [first, ...rest] = text.split('\n');
    const now = new Date().toISOString();
    const note: Note = { ...blank(quickKind), id: id(), title: first.slice(0, 120), body: rest.join('\n'), createdAt: now, updatedAt: now };
    setData(d => ({ ...d, notes: [note, ...d.notes] }));
    setQuick('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">ایده‌ها و یادداشت‌ها</h2>
          <p className="muted text-sm mt-1">هر فکری که به ذهنت رسید، همین‌جا ثبتش کن.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEdit(blank(kind === 'all' ? NOTE_KINDS[0] : kind))}><Plus size={18} /><span className="desktop-only">جزئیات کامل</span></button>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-start">
          <Zap size={18} className="accent mt-3 shrink-0 hidden sm:block" />
          <textarea rows={1} className="field resize-none basis-full sm:basis-0 sm:flex-1 order-first sm:order-none" value={quick} onChange={e => setQuick(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); capture(); } }}
            placeholder="ایده‌ات را بنویس و Enter بزن…" aria-label="ثبت سریع ایده" />
          <select className="field !w-auto flex-1 sm:flex-none" value={quickKind} onChange={e => setQuickKind(e.target.value)} aria-label="نوع">
            {kinds.map(k => <option key={k}>{k}</option>)}
          </select>
          <button className="btn btn-primary" onClick={capture} disabled={!quick.trim()}>ثبت</button>
        </div>
      </Card>

      <div className="relative">
        <Search className="absolute right-3 top-3 muted" size={17} />
        <input className="field pr-10" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو در ایده‌ها و یادداشت‌ها…" />
      </div>

      <div className="flex gap-2 overflow-auto pb-1">
        <button onClick={() => setKind('all')} className={`btn whitespace-nowrap ${kind === 'all' ? 'btn-primary' : ''}`}>همه <span className="chip">{data.notes.length}</span></button>
        {kinds.map(k => (
          <button key={k} onClick={() => setKind(k)} className={`btn whitespace-nowrap ${kind === k ? 'btn-primary' : ''}`}>
            {k} <span className="chip">{data.notes.filter(n => n.category === k).length}</span>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map(n => (
          <Card className="cursor-pointer" key={n.id}>
            <button className="w-full text-right" onClick={() => setEdit(n)}>
              <div className="flex justify-between"><span className="chip">{n.category}</span>{n.pinned && <Pin size={16} className="accent fill-current" />}</div>
              <h3 className="font-bold mt-4">{n.title || 'بدون عنوان'}</h3>
              <p className="muted text-sm mt-2 line-clamp-3 whitespace-pre-line min-h-14">{n.body || 'توضیحی نوشته نشده'}</p>
              <div className="flex flex-wrap gap-1 mt-4">{n.tags.map(t => <span key={t} className="chip">#{t}</span>)}</div>
            </button>
          </Card>
        ))}
        {!list.length && <Empty text="چیزی پیدا نشد. از نوار ثبت سریع بالا شروع کن." />}
      </div>
      {edit && <NoteForm note={edit} kinds={kinds} close={() => setEdit(null)} />}
    </div>
  );
}

function NoteForm({ note, kinds, close }: { note: Note; kinds: string[]; close: () => void }) {
  const { data, setData } = useStore();
  const [n, setN] = useState(note);
  const save = () => {
    const now = new Date().toISOString();
    setData(d => ({ ...d, notes: n.id ? d.notes.map(x => x.id === n.id ? { ...n, updatedAt: now } : x) : [{ ...n, id: id(), createdAt: now, updatedAt: now }, ...d.notes] }));
    close();
  };
  return (
    <Modal title={n.id ? 'ویرایش' : 'مورد جدید'} onClose={close} wide>
      <div className="space-y-4">
        <input className="field text-lg font-bold" value={n.title} onChange={e => setN({ ...n, title: e.target.value })} placeholder="عنوان…" />
        <textarea autoFocus className="field min-h-52" value={n.body} onChange={e => setN({ ...n, body: e.target.value })} placeholder="توضیحات (Markdown پشتیبانی می‌شود)…" />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">نوع<select className="field mt-1" value={n.category} onChange={e => setN({ ...n, category: e.target.value })}>{kinds.map(k => <option key={k}>{k}</option>)}</select></label>
          <label className="text-sm">برچسب‌ها<input className="field mt-1" value={n.tags.join('،')} onChange={e => setN({ ...n, tags: splitTags(e.target.value) })} /></label>
          <label className="text-sm">پروژه<select className="field mt-1" value={n.projectId || ''} onChange={e => setN({ ...n, projectId: e.target.value || undefined })}><option value="">بدون پروژه</option>{data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="text-sm">کار مرتبط<select className="field mt-1" value={n.taskId || ''} onChange={e => setN({ ...n, taskId: e.target.value || undefined })}><option value="">بدون کار</option>{data.tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
          <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={n.pinned} onChange={e => setN({ ...n, pinned: e.target.checked })} />سنجاق شود</label>
        </div>
        <div className="flex justify-between">
          <button className="btn text-rose-400" disabled={!n.id} onClick={() => { if (confirm('این مورد حذف شود؟')) { setData(d => ({ ...d, notes: d.notes.filter(x => x.id !== n.id) })); close(); } }}><Trash2 size={16} />حذف</button>
          <button className="btn btn-primary" onClick={save}>ذخیره</button>
        </div>
      </div>
    </Modal>
  );
}
