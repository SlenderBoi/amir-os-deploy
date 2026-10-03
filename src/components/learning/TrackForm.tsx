import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore, id } from '../../store';
import { Modal } from '../../ui';
import type { LearningTrack } from '../../types';

export const TRACK_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#ec4899'];
export const blankTrack = (): LearningTrack => ({ id: '', title: '', description: '', color: TRACK_COLORS[0], status: 'active', goalHours: 50, tags: [], resources: [], logs: [], createdAt: '' });

export default function TrackForm({ value, close }: { value: LearningTrack; close: () => void }) {
  const { setData } = useStore();
  const [x, setX] = useState(value);
  const save = () => {
    if (!x.title.trim()) return;
    setData(d => ({ ...d, learning: x.id ? d.learning.map(t => t.id === x.id ? x : t) : [{ ...x, id: id(), createdAt: new Date().toISOString() }, ...d.learning] }));
    close();
  };
  const remove = () => {
    if (!confirm(`مسیر «${x.title}» با ${x.logs.length} ثبت یادگیری‌اش حذف شود؟ این کار برگشت‌پذیر نیست.`)) return;
    setData(d => ({ ...d, learning: d.learning.filter(t => t.id !== x.id) }));
    close();
  };
  return (
    <Modal title={x.id ? 'ویرایش مسیر' : 'مسیر یادگیری جدید'} onClose={close} wide>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-sm">نام مهارت<input autoFocus className="field mt-1" value={x.title} onChange={e => setX({ ...x, title: e.target.value })} placeholder="مثلاً پایتون، انگلیسی، ترید…" /></label>
        <label className="text-sm">هدف زمانی (ساعت)<input type="number" min={1} className="field mt-1" value={x.goalHours} onChange={e => setX({ ...x, goalHours: Math.max(1, +e.target.value) })} /></label>
        <label className="md:col-span-2 text-sm">چرا می‌خواهی یاد بگیری؟<textarea className="field mt-1" value={x.description} onChange={e => setX({ ...x, description: e.target.value })} /></label>
        <label className="text-sm">وضعیت
          <select className="field mt-1" value={x.status} onChange={e => setX({ ...x, status: e.target.value as LearningTrack['status'] })}>
            <option value="active">فعال</option><option value="paused">مکث</option><option value="mastered">مسلط‌شده</option>
          </select>
        </label>
        <label className="text-sm">برچسب‌ها<input className="field mt-1" value={x.tags.join('،')} onChange={e => setX({ ...x, tags: e.target.value.split(/[،,]/).map(a => a.trim()).filter(Boolean) })} /></label>
        <div className="md:col-span-2">
          <p className="text-sm mb-2">رنگ مسیر</p>
          <div className="flex gap-2">{TRACK_COLORS.map(c => <button key={c} aria-label={c} className={`w-9 h-9 rounded-xl ${x.color === c ? 'ring-2 ring-white' : ''}`} style={{ background: c }} onClick={() => setX({ ...x, color: c })} />)}</div>
        </div>
      </div>
      <div className="flex justify-between mt-6">
        <button className="btn text-rose-400" disabled={!x.id} onClick={remove}><Trash2 size={16} />حذف</button>
        <div className="flex gap-2"><button className="btn" onClick={close}>لغو</button><button className="btn btn-primary" onClick={save}>ذخیره</button></div>
      </div>
    </Modal>
  );
}
