import { useMemo, useState } from 'react';
import { ArrowRight, ArrowLeft, BookOpen, CheckCircle2, Circle, ListPlus, Search, Sparkles, Trash2, CalendarPlus } from 'lucide-react';
import { Card, Empty, faHours, faNum, money } from '../ui';
import JalaliDateInput from '../components/JalaliDateInput';
import { useStore } from '../store';
import { localISO } from '../services/dates';
import { addDaysISO, diffDays, formatJalali } from '../services/jalali';
import { dayStats } from '../services/analytics';
import { MAX_INTENTIONS, emptyEntry, entryFor, intentionDone, journalStreak, onThisDay, saveEntry, searchJournal, snippet, taskFromIntention, type TextField } from '../services/journal';
import type { DailyLog, Intention } from '../types';

const PROMPTS: { key: TextField; title: string; hint: string }[] = [
  { key: 'wins', title: 'امروز چی خوب پیش رفت؟', hint: 'یک پیروزی کوچک هم حساب است.' },
  { key: 'improve', title: 'فردا چی رو بهتر می‌کنم؟', hint: 'یک تغییر مشخص، نه قضاوت خودت.' },
  { key: 'gratitude', title: 'برای چی سپاسگزارم؟', hint: 'یکی دو مورد.' },
  { key: 'note', title: 'یادداشت آزاد', hint: 'هر چیزی که تو ذهنت هست.' },
];

export default function Journal() {
  const { data, setData } = useStore();
  const today = localISO();
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(12);

  const entry = entryFor(data.journal, date);
  const view: DailyLog = entry ?? { ...emptyEntry(date), id: 'blank' };
  const stats = useMemo(() => dayStats(data).get(date), [data, date]);
  const health = data.health.find(h => h.date === date);
  const doneTitles = data.tasks.filter(t => t.completedAt && localISO(new Date(t.completedAt)) === date).map(t => t.title);
  const streak = journalStreak(data.journal, today);
  const echoes = onThisDay(data.journal, date);
  const history = searchJournal(data.journal, q);
  const rel = diffDays(today, date);
  const heading = `${rel === 0 ? 'امروز · ' : rel === 1 ? 'دیروز · ' : rel === -1 ? 'فردا · ' : ''}${formatJalali(date, { weekday: true })}`;

  /** All edits go through here so one page per date is guaranteed and empty pages disappear. */
  const patch = (fn: (e: DailyLog) => DailyLog) => setData(d => ({ ...d, journal: saveEntry(d.journal, fn(entryFor(d.journal, date) ?? emptyEntry(date))) }));

  const addIntention = () => {
    const text = draft.trim();
    if (!text || view.intentions.length >= MAX_INTENTIONS) return;
    patch(e => ({ ...e, intentions: [...e.intentions, { id: crypto.randomUUID(), text, done: false }] }));
    setDraft('');
  };
  const edit = (id: string, fn: (i: Intention) => Intention) => patch(e => ({ ...e, intentions: e.intentions.map(i => i.id === id ? fn(i) : i) }));
  const makeTask = (i: Intention) => setData(d => {
    const task = taskFromIntention(i, date);
    const cur = entryFor(d.journal, date);
    if (!cur) return d;
    const next = { ...cur, intentions: cur.intentions.map(x => x.id === i.id ? { ...x, taskId: task.id } : x) };
    return { ...d, tasks: [...d.tasks, task], journal: saveEntry(d.journal, next) };
  });
  const carryOver = (i: Intention) => setData(d => {
    const cur = entryFor(d.journal, date);
    if (!cur) return d;
    const tomorrow = addDaysISO(date, 1);
    const target = entryFor(d.journal, tomorrow) ?? emptyEntry(tomorrow);
    const moved = { ...target, intentions: [...target.intentions, { id: crypto.randomUUID(), text: i.text, done: false }].slice(0, MAX_INTENTIONS) };
    const left = { ...cur, intentions: cur.intentions.filter(x => x.id !== i.id) };
    return { ...d, journal: saveEntry(saveEntry(d.journal, moved), left) };
  });

  const full = view.intentions.length >= MAX_INTENTIONS;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="accent" />ثبت روزانه</h1>
          <p className="text-sm muted mt-1">صبح برنامه، شب مرور. چند خط کافی است.</p>
        </div>
        <div className="flex items-center gap-2 text-sm" aria-label="پیوستگی نوشتن">
          <span className="chip">🔥 {faNum(streak.current)} روز پیاپی</span>
          <span className="chip muted">رکورد {faNum(streak.longest)}</span>
        </div>
      </div>

      <Card className="!p-3 flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => setDate(addDaysISO(date, -1))} aria-label="روز قبل"><ArrowRight size={16} />روز قبل</button>
        <button className="btn" onClick={() => setDate(addDaysISO(date, 1))} aria-label="روز بعد">روز بعد<ArrowLeft size={16} /></button>
        <div className="w-40"><JalaliDateInput value={date} onChange={iso => iso && setDate(iso)} ariaLabel="تاریخ صفحه" /></div>
        {date !== today && <button className="btn" onClick={() => setDate(today)}>امروز</button>}
        <h2 className="mr-auto font-bold" aria-live="polite">{heading}</h2>
      </Card>

      {echoes.length > 0 && (
        <Card className="!p-4 space-y-2">
          <div className="text-sm font-bold flex items-center gap-2"><Sparkles size={16} className="accent" />در همین روز، قبلاً</div>
          {echoes.map(({ ago, entry: e }) => (
            <button key={ago} className="block w-full text-right text-sm hover:bg-white/5 rounded-lg p-2" onClick={() => setDate(e.date)}>
              <span className="muted text-xs">{ago === 7 ? 'یک هفته پیش' : ago === 30 ? '۳۰ روز پیش' : 'یک سال پیش'} · {formatJalali(e.date)}</span>
              <span className="block mt-0.5">{snippet(e, 140)}</span>
            </button>
          ))}
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h3 className="font-bold mb-1">اولویت‌های روز</h3>
            <p className="text-xs muted mb-3">حداکثر {faNum(MAX_INTENTIONS)} چیز؛ هر کدام را می‌توانی به کار واقعی تبدیل کنی یا به فردا ببری.</p>
            <ul className="space-y-2" aria-label="اولویت‌ها">
              {view.intentions.map(i => {
                const done = intentionDone(data, i);
                const linked = !!i.taskId && data.tasks.some(t => t.id === i.taskId);
                return (
                  <li key={i.id} className="flex items-center gap-2 rounded-xl p-2" style={{ background: 'var(--panel2)' }}>
                    <button className={done ? 'text-emerald-400' : 'muted'} aria-label={done ? 'انجام شد' : 'انجام نشده'} onClick={() => !linked && edit(i.id, x => ({ ...x, done: !x.done }))} disabled={linked} title={linked ? 'وضعیت از روی کار پیوندشده می‌آید' : undefined}>
                      {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                    </button>
                    <span className={`flex-1 text-sm ${done ? 'line-through muted' : ''}`}>{i.text}</span>
                    {linked ? <span className="chip text-[11px]">کار ساخته شد</span> : (
                      <button className="btn !p-1.5" title="تبدیل به کار با موعد همین روز" aria-label={`تبدیل «${i.text}» به کار`} onClick={() => makeTask(i)}><ListPlus size={15} /></button>
                    )}
                    {!done && <button className="btn !p-1.5" title="انتقال به روز بعد" aria-label={`انتقال «${i.text}» به فردا`} onClick={() => carryOver(i)}><CalendarPlus size={15} /></button>}
                    <button className="btn !p-1.5" aria-label={`حذف «${i.text}»`} onClick={() => patch(e => ({ ...e, intentions: e.intentions.filter(x => x.id !== i.id) }))}><Trash2 size={15} /></button>
                  </li>
                );
              })}
            </ul>
            <form className="flex gap-2 mt-3" onSubmit={e => { e.preventDefault(); addIntention(); }}>
              <input className="field" placeholder={full ? 'به سقف رسیده‌ای' : 'امروز مهم‌ترین چیز چیست؟'} value={draft} onChange={e => setDraft(e.target.value)} disabled={full} aria-label="اولویت جدید" />
              <button className="btn btn-primary" disabled={full || !draft.trim()}>افزودن</button>
            </form>
          </Card>

          {PROMPTS.map(p => (
            <Card key={p.key}>
              <label className="block font-bold" htmlFor={`j-${p.key}`}>{p.title}</label>
              <p className="text-xs muted mb-2">{p.hint}</p>
              <textarea id={`j-${p.key}`} className="field min-h-24" value={view[p.key]} onChange={e => patch(x => ({ ...x, [p.key]: e.target.value }))} />
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="font-bold mb-3">خلاصهٔ خودکار این روز</h3>
            {stats || health || doneTitles.length ? (
              <dl className="text-sm space-y-2">
                <Row k="کار انجام‌شده" v={faNum(stats?.tasksDone ?? 0)} />
                <Row k="ساعت تمرکز" v={faHours((stats?.taskMin ?? 0) + (stats?.learnMin ?? 0))} />
                <Row k="عادت‌ها" v={data.habits.length ? `${faNum(stats?.habitsDone ?? 0)} از ${faNum(data.habits.length)}` : '—'} />
                <Row k="هزینه" v={money(stats?.expense ?? 0)} />
                {health && <Row k="سلامت" v={`خواب ${faNum(health.sleep)} ساعت · انرژی ${faNum(health.energy)}/۵`} />}
              </dl>
            ) : <Empty text="برای این روز چیزی ثبت نشده." />}
            {doneTitles.length > 0 && (
              <div className="mt-3 pt-3 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
                <div className="muted mb-1">کارهای انجام‌شده</div>
                <ul className="space-y-1">{doneTitles.slice(0, 6).map((t, i) => <li key={i}>✓ {t}</li>)}{doneTitles.length > 6 && <li className="muted">و {faNum(doneTitles.length - 6)} مورد دیگر</li>}</ul>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-bold mb-3 flex items-center gap-2"><Search size={16} className="accent" />صفحه‌های قبلی</h3>
            <input className="field mb-3" placeholder="جستجو در نوشته‌ها…" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجو در نوشته‌ها" />
            {history.length === 0 ? <Empty text={data.journal.length ? 'چیزی پیدا نشد.' : 'هنوز صفحه‌ای ننوشته‌ای.'} /> : (
              <ul className="space-y-1" aria-label="صفحه‌های قبلی">
                {history.slice(0, shown).map(e => (
                  <li key={e.id}>
                    <button className={`w-full text-right rounded-lg p-2 hover:bg-white/5 ${e.date === date ? 'bg-white/5' : ''}`} onClick={() => { setDate(e.date); scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      <span className="block text-xs muted">{formatJalali(e.date, { weekday: true })}</span>
                      <span className="block text-sm truncate">{snippet(e, 70)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {history.length > shown && <button className="btn w-full mt-2" onClick={() => setShown(s => s + 12)}>نمایش بیشتر</button>}
          </Card>
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-2"><dt className="muted">{k}</dt><dd className="font-bold">{v}</dd></div>;
