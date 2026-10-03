import JalaliDateInput from '../JalaliDateInput';import { useMemo, useState } from 'react';
import { Check, Download, Lightbulb, ListTodo, Pencil, Play, Plus, Search, Square, Trash2 } from 'lucide-react';
import { useStore, id, today } from '../../store';
import { Empty, Meter, Modal, faHours, faNum } from '../../ui';
import Heatmap from '../Heatmap';
import { minutesByDate, studyStreak, trackMarkdown } from '../../services/learning';
import { startTimer, stopTimer } from '../../services/timer';
import { toTask } from '../../services/quickTask';
import type { LearningLog, LearningTrack } from '../../types';

export const LOG_KINDS = ['ویدیو', 'مقاله', 'کتاب', 'تمرین', 'پروژه', 'پادکست', 'کلاس'] as const;
const TABS = [['log', 'ثبت'], ['timeline', 'تایم‌لاین'], ['points', 'دفتر نکات'], ['resources', 'منابع']] as const;
type Tab = typeof TABS[number][0];
const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);
const dayFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' });
const blankLog = (minutes = 30): LearningLog => ({ id: '', date: today(), minutes, topic: '', notes: '', keyPoints: [], ideas: [], kind: LOG_KINDS[0], createdAt: '' });

export default function TrackDetail({ track, initialMinutes, close }: { track: LearningTrack; initialMinutes?: number; close: () => void }) {
  const { data, setData } = useStore();
  const [tab, setTab] = useState<Tab>('log');
  const [log, setLog] = useState<LearningLog>(() => blankLog(initialMinutes ?? 30));
  // Raw text is kept separately: re-deriving it from the parsed arrays would swallow trailing newlines while typing.
  const [kpText, setKpText] = useState('');
  const [ideaText, setIdeaText] = useState('');
  const loadLog = (l: LearningLog) => { setLog(l); setKpText(l.keyPoints.join('\n')); setIdeaText(l.ideas.join('\n')); };
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const byDate = useMemo(() => minutesByDate([track]), [track]);
  const streak = studyStreak(byDate);
  const totalMin = track.logs.reduce((a, l) => a + l.minutes, 0);
  const goalPct = (totalMin / (track.goalHours * 60)) * 100;
  const timerHere = data.timer?.kind === 'learning' && data.timer.refId === track.id;
  const timerBusy = !!data.timer && !timerHere;

  const patchTrack = (fn: (t: LearningTrack) => LearningTrack) => setData(d => ({ ...d, learning: d.learning.map(t => t.id === track.id ? fn(t) : t) }));

  const save = () => {
    if (!log.topic.trim()) return;
    const now = new Date().toISOString();
    patchTrack(t => ({ ...t, logs: log.id ? t.logs.map(l => l.id === log.id ? log : l) : [{ ...log, id: id(), createdAt: now }, ...t.logs] }));
    loadLog(blankLog());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const visibleLogs = useMemo(() => {
    const n = q.trim().toLowerCase();
    return [...track.logs]
      .filter(l => !n || `${l.topic} ${l.notes} ${l.keyPoints.join(' ')} ${l.ideas.join(' ')}`.toLowerCase().includes(n))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [track.logs, q]);

  const sendIdea = (idea: string, l: LearningLog, as: 'note' | 'task') => {
    const key = `${as}:${l.id}:${idea}`;
    const now = new Date().toISOString();
    setData(d => as === 'task'
      ? { ...d, tasks: [{ ...toTask({ title: idea, priority: 'medium', tags: [track.title], subtasks: [] }), notes: `از یادگیری «${track.title}» — ${l.topic}` }, ...d.tasks] }
      : d.notes.some(n => n.title === idea && n.category === 'ایده') ? d
        : { ...d, notes: [{ id: id(), title: idea, body: `از یادگیری «${track.title}» — ${l.topic} (${l.date})`, category: 'ایده', tags: [track.title], pinned: false, createdAt: now, updatedAt: now }, ...d.notes] });
    setSent(s => new Set(s).add(key));
  };

  const exportMd = () => {
    const blob = new Blob([trackMarkdown(track)], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${track.title}.md`; a.click(); URL.revokeObjectURL(a.href);
  };

  const [res, setRes] = useState({ title: '', url: '' });
  const addResource = () => {
    if (!res.title.trim()) return;
    patchTrack(t => ({ ...t, resources: [...t.resources, { id: id(), title: res.title.trim(), url: res.url.trim() || undefined, done: false }] }));
    setRes({ title: '', url: '' });
  };
  const resDone = track.resources.filter(r => r.done).length;

  return (
    <Modal title={track.title} onClose={close} wide>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-center">
        <Stat label="زمان کل" value={`${faHours(totalMin)} ساعت`} />
        <Stat label="جلسه‌ها" value={faNum(track.logs.length)} />
        <Stat label="زنجیرهٔ این مسیر" value={`${faNum(streak.current)} روز`} />
        <Stat label="رکورد زنجیره" value={`${faNum(streak.longest)} روز`} />
      </div>
      <div className="flex justify-between text-xs mb-1.5"><span>{faHours(totalMin)} از {faNum(track.goalHours)} ساعت هدف</span><span>٪{faNum(Math.min(100, Math.round(goalPct)))}</span></div>
      <Meter value={goalPct} />
      <div className="my-5"><Heatmap minutes={byDate} weeks={14} /></div>

      <div className="flex gap-2 flex-wrap mb-4">
        <button className={`btn ${timerHere ? 'btn-primary' : ''}`} disabled={timerBusy} title={timerBusy ? 'ابتدا تایمر در حال اجرا را متوقف کن' : undefined}
          onClick={() => setData(d => timerHere ? stopTimer(d).db : startTimer(d, { kind: 'learning', refId: track.id, label: track.title }))}>
          {timerHere ? <><Square size={15} className="fill-current" />توقف (از نوار تایمر ثبت کن)</> : <><Play size={15} />شروع تایمر مطالعه</>}
        </button>
        <button className="btn" onClick={exportMd} disabled={!track.logs.length}><Download size={15} />خروجی Markdown</button>
      </div>

      <div className="flex gap-1 p-1 rounded-xl mb-4 overflow-auto" style={{ background: 'var(--panel2)' }} role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn border-0 flex-1 whitespace-nowrap text-sm ${tab === k ? 'btn-primary' : '!bg-transparent'}`}>
            {label}{k === 'timeline' && ` (${faNum(track.logs.length)})`}{k === 'resources' && track.resources.length > 0 && ` (${faNum(resDone)}/${faNum(track.resources.length)})`}
          </button>
        ))}
      </div>

      {tab === 'log' && (
        <div className="space-y-3">
          <h3 className="font-bold">{log.id ? 'ویرایش ثبت' : 'امروز چی یاد گرفتم؟'}</h3>
          {initialMinutes && !log.id && <p className="text-xs rounded-lg p-2 bg-emerald-500/10 text-emerald-300">تایمر {faNum(initialMinutes)} دقیقه ثبت کرد؛ فقط بنویس چی دیدی.</p>}
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs">تاریخ<JalaliDateInput value={log.date} onChange={v => setLog({ ...log, date: v })} /></label>
            <label className="text-xs">دقیقه<input type="number" min={0} className="field mt-1" value={log.minutes} onChange={e => setLog({ ...log, minutes: Math.max(0, +e.target.value) })} /></label>
            <label className="text-xs">نوع<select className="field mt-1" value={log.kind ?? ''} onChange={e => setLog({ ...log, kind: e.target.value })}>{LOG_KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
          </div>
          <label className="text-xs block">موضوع<input className="field mt-1" value={log.topic} onChange={e => setLog({ ...log, topic: e.target.value })} placeholder="مثلاً list comprehension" /></label>
          <label className="text-xs block">شرح آزاد<textarea className="field mt-1 min-h-24" value={log.notes} onChange={e => setLog({ ...log, notes: e.target.value })} placeholder="چه دیدی و چه فهمیدی؟ (Markdown)" /></label>
          <label className="text-xs block">نکات کلیدی — هر خط یک نکته<textarea className="field mt-1" value={kpText} onChange={e => { setKpText(e.target.value); setLog({ ...log, keyPoints: lines(e.target.value) }); }} /></label>
          <label className="text-xs block">ایده‌ها و کاربردها — هر خط یک ایده<textarea className="field mt-1" value={ideaText} onChange={e => { setIdeaText(e.target.value); setLog({ ...log, ideas: lines(e.target.value) }); }} /></label>
          <label className="text-xs block">لینک منبع<input dir="ltr" className="field mt-1 text-left" value={log.resource || ''} onChange={e => setLog({ ...log, resource: e.target.value })} /></label>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={save} disabled={!log.topic.trim()}>{log.id ? 'ذخیرهٔ تغییرات' : 'ثبت در دفتر یادگیری'}</button>
            {log.id && <button className="btn" onClick={() => loadLog(blankLog())}>لغو ویرایش</button>}
          </div>
          {saved && <p className="text-sm text-emerald-400" role="status">✓ ثبت شد. فردا برای مرور به تو یادآوری می‌شود.</p>}
        </div>
      )}

      {tab === 'timeline' && (
        <div>
          <div className="relative mb-3"><Search className="absolute right-3 top-3 muted" size={17} /><input className="field pr-10" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو در موضوع، نکته و ایده…" /></div>
          <div className="space-y-3 max-h-[520px] overflow-auto scrollbar">
            {visibleLogs.map((l, i) => (
              <div key={l.id}>
                {(i === 0 || visibleLogs[i - 1].date !== l.date) && <div className="text-[11px] accent mb-2 mt-1">{dayFmt.format(new Date(l.date + 'T12:00:00'))}</div>}
                <div className="p-3 rounded-xl" style={{ background: 'var(--panel2)' }}>
                  <div className="flex justify-between gap-2"><b className="text-sm">{l.topic}</b><span className="text-[11px] muted shrink-0">{l.kind && `${l.kind} • `}{faNum(l.minutes)} دقیقه</span></div>
                  {l.notes && <p className="text-sm muted mt-2 whitespace-pre-line">{l.notes}</p>}
                  {l.keyPoints.length > 0 && <div className="mt-3"><span className="text-xs accent">نکات کلیدی</span><ul className="text-xs mt-1 space-y-1">{l.keyPoints.map((x, k) => <li key={k}>• {x}</li>)}</ul></div>}
                  {l.ideas.length > 0 && (
                    <div className="mt-3 p-2 rounded-lg bg-violet-500/10">
                      <span className="text-xs flex gap-1"><Lightbulb size={14} className="text-amber-400" />ایده‌ها</span>
                      {l.ideas.map((x, k) => (
                        <div key={k} className="flex items-center justify-between gap-2 mt-1.5 text-xs">
                          <span>• {x}</span>
                          <span className="flex gap-1 shrink-0">
                            <button className="chip" onClick={() => sendIdea(x, l, 'note')} title="ذخیره در ایده‌ها">{sent.has(`note:${l.id}:${x}`) ? <Check size={12} /> : <Plus size={12} />}ایده</button>
                            <button className="chip" onClick={() => sendIdea(x, l, 'task')} title="ساخت کار">{sent.has(`task:${l.id}:${x}`) ? <Check size={12} /> : <ListTodo size={12} />}کار</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {l.resource && <a href={/^https?:\/\//.test(l.resource) ? l.resource : undefined} target="_blank" rel="noopener noreferrer" dir="ltr" className="block text-[11px] accent mt-2 truncate">{l.resource}</a>}
                  <div className="flex gap-4 mt-3">
                    <button className="text-[11px] muted flex gap-1 items-center" onClick={() => { loadLog(l); setTab('log'); }}><Pencil size={12} />ویرایش</button>
                    <button className="text-[11px] text-rose-400 flex gap-1 items-center" onClick={() => confirm('این ثبت حذف شود؟') && patchTrack(t => ({ ...t, logs: t.logs.filter(x => x.id !== l.id) }))}><Trash2 size={12} />حذف</button>
                  </div>
                </div>
              </div>
            ))}
            {!visibleLogs.length && <Empty text={q ? 'چیزی پیدا نشد.' : 'اولین یادگیری‌ات را ثبت کن.'} />}
          </div>
        </div>
      )}

      {tab === 'points' && (
        <div className="space-y-2 max-h-[520px] overflow-auto scrollbar">
          {visibleLogs.flatMap(l => l.keyPoints.map((k, i) => ({ k, l, key: `${l.id}-${i}` }))).map(({ k, l, key }) => (
            <div key={key} className="p-3 rounded-xl text-sm flex justify-between gap-3" style={{ background: 'var(--panel2)' }}><span>{k}</span><span className="text-[11px] muted shrink-0">{l.topic}</span></div>
          ))}
          {!track.logs.some(l => l.keyPoints.length) && <Empty text="هنوز نکته‌ای ثبت نشده. نکته‌ها همین‌جا جمع می‌شوند." />}
        </div>
      )}

      {tab === 'resources' && (
        <div className="space-y-2">
          {track.resources.map(r => (
            <div key={r.id} className="flex items-center gap-2">
              <button className={`btn p-2 ${r.done ? 'btn-primary' : ''}`} aria-label="تکمیل شد" onClick={() => patchTrack(t => ({ ...t, resources: t.resources.map(x => x.id === r.id ? { ...x, done: !x.done } : x) }))}>{r.done ? <Check size={15} /> : <span className="w-[15px]" />}</button>
              <div className={`flex-1 min-w-0 ${r.done ? 'line-through muted' : ''}`}>
                <div className="truncate">{r.title}</div>
                {r.url && <a href={/^https?:\/\//.test(r.url) ? r.url : undefined} target="_blank" rel="noopener noreferrer" dir="ltr" className="block text-[11px] accent truncate">{r.url}</a>}
              </div>
              <button className="btn p-2" aria-label="حذف منبع" onClick={() => patchTrack(t => ({ ...t, resources: t.resources.filter(x => x.id !== r.id) }))}><Trash2 size={15} /></button>
            </div>
          ))}
          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 pt-2">
            <input className="field" value={res.title} onChange={e => setRes({ ...res, title: e.target.value })} onKeyDown={e => e.key === 'Enter' && addResource()} placeholder="نام دوره، کتاب یا ویدیو…" />
            <input dir="ltr" className="field text-left" value={res.url} onChange={e => setRes({ ...res, url: e.target.value })} onKeyDown={e => e.key === 'Enter' && addResource()} placeholder="https://…" />
            <button className="btn btn-primary" onClick={addResource}>افزودن</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl p-3" style={{ background: 'var(--panel2)' }}><p className="text-[11px] muted">{label}</p><b className="block mt-1">{value}</b></div>;
}
