import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '../../ui';
import JalaliDateInput from '../JalaliDateInput';
import { id, useStore } from '../../store';
import type { Event } from '../../types';

export const blankEvent = (date: string): Event => ({ id: '', title: '', date, start: '09:00', end: '10:00', kind: 'work', createdAt: '' });

export default function EventForm({ value, close }: { value: Event; close: () => void }) {
  const { data, setData } = useStore();
  const [x, setX] = useState(value);
  const conflict = data.events.some(e => e.id !== x.id && e.date === x.date && x.start < e.end && x.end > e.start);
  const invalid = !x.title.trim() || !x.date || x.start >= x.end;

  const save = () => {
    if (invalid) return;
    setData(d => ({ ...d, events: x.id ? d.events.map(e => e.id === x.id ? x : e) : [...d.events, { ...x, id: id(), createdAt: new Date().toISOString() }] }));
    close();
  };

  return (
    <Modal title="بلوک زمانی" onClose={close}>
      <div className="space-y-4">
        <label className="text-sm block">عنوان<input className="field mt-1" value={x.title} onChange={e => setX({ ...x, title: e.target.value })} autoFocus /></label>
        <div className="text-sm">تاریخ<JalaliDateInput value={x.date} onChange={v => setX({ ...x, date: v })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">شروع<input type="time" className="field mt-1" value={x.start} onChange={e => setX({ ...x, start: e.target.value })} /></label>
          <label className="text-sm">پایان<input type="time" className="field mt-1" value={x.end} onChange={e => setX({ ...x, end: e.target.value })} /></label>
        </div>
        <label className="text-sm block">نوع
          <select className="field mt-1" value={x.kind} onChange={e => setX({ ...x, kind: e.target.value as Event['kind'] })}>
            <option value="work">کاری</option><option value="personal">شخصی</option><option value="reminder">یادآور</option>
          </select>
        </label>
        <label className="text-sm block">کار مرتبط
          <select className="field mt-1" value={x.taskId || ''} onChange={e => setX({ ...x, taskId: e.target.value || undefined })}>
            <option value="">بدون کار</option>
            {data.tasks.filter(t => !['done', 'archived'].includes(t.status)).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        {x.start >= x.end && <div className="text-xs text-rose-400">ساعت پایان باید بعد از شروع باشد.</div>}
        {conflict && <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 text-sm flex gap-2"><AlertTriangle size={18} />این بازه با برنامه دیگری تداخل دارد.</div>}
        <div className="flex justify-between">
          <div>{x.id && <button className="btn text-rose-400" onClick={() => { if (confirm('حذف شود؟')) { setData(d => ({ ...d, events: d.events.filter(e => e.id !== x.id) })); close(); } }}><Trash2 size={16} />حذف</button>}</div>
          <button className="btn btn-primary" disabled={invalid} onClick={save}>ذخیره</button>
        </div>
      </div>
    </Modal>
  );
}
