import { AlarmClock } from 'lucide-react';
import { Card, faNum } from '../ui';
import { useStore } from '../store';
import { LEADS, leadOf } from '../services/taskTime';
import { testAlarmEvent } from './AlarmCenter';

export default function TaskAlarmSettings() {
  const { data, setData } = useStore();
  const s = data.settings, lead = leadOf(data);
  const patch = (x: Partial<typeof s>) => setData(d => ({ ...d, settings: { ...d.settings, ...x } }));
  return (
    <Card>
      <div className="flex items-center gap-2 mb-1 font-bold"><AlarmClock size={18} className="accent" />آلارم کارهای ساعت‌دار</div>
      <p className="text-xs muted mb-4 leading-6">به هر کار می‌توانی ساعت بدهی (مثلاً ۰۷:۳۰). قبل از آن ساعت، آلارم می‌خورد. وقتی برنامه باز است: بنر + صدا (+ اعلان سیستم، اگر در «اعلان‌ها» اجازه داده باشی). وقتی برنامه بسته است: فقط اعلان موبایل (ntfy) بیدارت می‌کند.</p>
      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <span className="text-sm">آلارم چند دقیقه قبل از ساعت کار بخورد؟</span>
        <select className="field !w-40" aria-label="پیش‌یادآور کار" value={lead} onChange={e => patch({ taskLead: Number(e.target.value) })}>{LEADS.map(m => <option key={m} value={m}>{m ? `${faNum(m)} دقیقه قبل` : 'سر وقت'}</option>)}</select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={s.alarmSound !== false} onChange={e => patch({ alarmSound: e.target.checked })} />صدای آلارم</label>
        <button className="btn" onClick={() => dispatchEvent(new Event(testAlarmEvent))}>آزمایش آلارم</button>
      </div>
      <p className="text-[11px] muted mt-2">مرورگرها تا وقتی یک بار صفحه را لمس نکرده باشی ممکن است صدا را ببندند. روی گوشی، صدای اعلان ntfy از خود اپ ntfy می‌آید.</p>
    </Card>
  );
}
