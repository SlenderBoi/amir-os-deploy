import { useEffect, useMemo, useState } from 'react';
import { Brain, Clock3, Flame, GraduationCap, Play, Plus, Search, Square, Trophy } from 'lucide-react';
import { useStore, today } from '../store';
import { Card, Empty, Meter, faHours, faNum } from '../ui';
import Heatmap from '../components/Heatmap';
import TrackForm, { blankTrack } from '../components/learning/TrackForm';
import TrackDetail from '../components/learning/TrackDetail';
import ReviewSession from '../components/learning/ReviewSession';
import { LEARNING_DRAFT_EVENT, LEARNING_DRAFT_KEY } from '../components/TimerBar';
import { minutesByDate, minutesInLastDays, studyStreak } from '../services/learning';
import { dueCards } from '../services/srs';
import { startTimer, stopTimer } from '../services/timer';
import { normalize } from '../components/CommandPalette';
import type { LearningTrack } from '../types';

const STATUS_FA = { active: 'فعال', paused: 'مکث', mastered: 'مسلط‌شده' } as const;

export default function Learning() {
  const { data, setData } = useStore();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<LearningTrack | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draftMinutes, setDraftMinutes] = useState<number | undefined>();
  const [reviewing, setReviewing] = useState(false);

  // A stopped study timer hands its minutes over through sessionStorage, so the log form opens pre-filled.
  useEffect(() => {
    const read = () => {
      const raw = sessionStorage.getItem(LEARNING_DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(LEARNING_DRAFT_KEY);
      try { const d = JSON.parse(raw) as { trackId: string; minutes: number }; setSelected(d.trackId); setDraftMinutes(d.minutes); } catch { /* ignore malformed draft */ }
    };
    read();
    window.addEventListener(LEARNING_DRAFT_EVENT, read);
    return () => window.removeEventListener(LEARNING_DRAFT_EVENT, read);
  }, []);

  const byDate = useMemo(() => minutesByDate(data.learning), [data.learning]);
  const streak = studyStreak(byDate);
  const totalMinutes = Object.values(byDate).reduce((a, b) => a + b, 0);
  const due = useMemo(() => dueCards(data), [data.learning, data.reviews]);
  const needle = normalize(q);
  const tracks = useMemo(() => data.learning
    .filter(t => normalize(`${t.title} ${t.description} ${t.tags.join(' ')} ${t.logs.map(l => l.topic).join(' ')}`).includes(needle))
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')), [data.learning, needle]);
  const active = data.learning.find(t => t.id === selected);

  const toggleTimer = (t: LearningTrack) => setData(d => d.timer?.kind === 'learning' && d.timer.refId === t.id ? stopTimer(d).db : startTimer(d, { kind: 'learning', refId: t.id, label: t.title }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">آکادمی شخصی</h2>
          <p className="muted text-sm mt-1">هر روز چیزی که دیدی را ثبت کن؛ ما فردا و هفتهٔ بعد از تو می‌پرسیم تا یادت بماند.</p>
        </div>
        <div className="flex gap-2">
          <button className={`btn ${due.length ? 'btn-primary' : ''}`} onClick={() => setReviewing(true)}><Brain size={18} />مرور امروز{due.length > 0 && <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>{faNum(due.length)}</span>}</button>
          <button className="btn" onClick={() => setEdit(blankTrack())}><Plus size={18} />مسیر یادگیری</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Mini icon={<Clock3 />} label="یادگیری امروز" value={`${faNum(byDate[today()] ?? 0)} دقیقه`} />
        <Mini icon={<GraduationCap />} label="۷ روز اخیر" value={`${faHours(minutesInLastDays(byDate, 7))} ساعت`} />
        <Mini icon={<Flame />} label="زنجیرهٔ یادگیری" value={`${faNum(streak.current)} روز`} />
        <Mini icon={<Trophy />} label="رکورد زنجیره" value={`${faNum(streak.longest)} روز`} />
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold">نقشهٔ روزهای یادگیری</h3><span className="text-xs muted">{faHours(totalMinutes)} ساعت در مجموع</span></div>
        <Heatmap minutes={byDate} weeks={26} />
      </Card>

      <div className="relative"><Search className="absolute right-3 top-3 muted" size={17} /><input className="field pr-10" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو در مهارت‌ها و موضوع‌های ثبت‌شده…" /></div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tracks.map(t => {
          const mins = t.logs.reduce((a, x) => a + x.minutes, 0);
          const pct = (mins / (t.goalHours * 60)) * 100;
          const last = [...t.logs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
          const running = data.timer?.kind === 'learning' && data.timer.refId === t.id;
          const busy = !!data.timer && !running;
          return (
            <Card key={t.id} className="relative overflow-hidden">
              <i className="absolute right-0 top-0 bottom-0 w-1" style={{ background: t.color }} />
              <button className="w-full text-right" onClick={() => setSelected(t.id)}>
                <div className="flex justify-between"><span className="chip">{STATUS_FA[t.status]}</span><span className="text-xs muted">{faNum(t.logs.length)} جلسه</span></div>
                <h3 className="text-xl font-bold mt-4">{t.title}</h3>
                <p className="text-sm muted mt-2 line-clamp-2 min-h-10">{t.description || 'بدون توضیح'}</p>
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-2"><span>{faHours(mins)} از {faNum(t.goalHours)} ساعت</span><span>٪{faNum(Math.min(100, Math.round(pct)))}</span></div>
                  <Meter value={pct} />
                </div>
                <p className="text-[11px] muted mt-3 truncate">{last ? `آخرین: ${last.topic} (${last.date})` : 'هنوز چیزی ثبت نشده'}</p>
                <div className="flex flex-wrap gap-1 mt-3">{t.tags.map(x => <span key={x} className="chip">#{x}</span>)}</div>
              </button>
              <div className="flex gap-2 mt-4">
                <button className="btn btn-primary flex-1 text-sm" onClick={() => setSelected(t.id)}>ثبت یادگیری</button>
                <button className={`btn ${running ? 'btn-primary' : ''}`} disabled={busy} onClick={() => toggleTimer(t)} aria-label={running ? 'توقف تایمر' : 'شروع تایمر'} title={busy ? 'ابتدا تایمر در حال اجرا را متوقف کن' : undefined}>{running ? <Square size={16} className="fill-current" /> : <Play size={16} />}</button>
                <button className="btn" onClick={() => setEdit(t)}>ویرایش</button>
              </div>
            </Card>
          );
        })}
        {!tracks.length && <Empty text="یک مهارت مثل پایتون، انگلیسی یا ترید اضافه کن." />}
      </div>

      {edit && <TrackForm value={edit} close={() => setEdit(null)} />}
      {active && <TrackDetail key={active.id} track={active} initialMinutes={draftMinutes} close={() => { setSelected(null); setDraftMinutes(undefined); }} />}
      {reviewing && <ReviewSession close={() => setReviewing(false)} />}
    </div>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card><div className="flex justify-between"><div><p className="text-xs muted">{label}</p><b className="block text-xl mt-2">{value}</b></div><span className="accent">{icon}</span></div></Card>;
}
