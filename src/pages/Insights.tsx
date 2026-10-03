import { useMemo, useState } from 'react';
import { Activity, BarChart3, Flame, Lightbulb, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, Empty, faHours, faNum, money } from '../ui';
import { Delta, GroupedBars, HBars, StackedBars } from '../components/insights/charts';
import { activeStreaks, categorySpend, dayStats, delta, focusBuckets, habitBreakdown, insights, learningByTrack, monthlyFinance, previousRange, rangeFor, totals, weekdayAverages, type RangeKind } from '../services/analytics';
import { buildTimeline, groupByDay, KIND_LABEL, type TimelineKind } from '../services/timeline';
import { diffDays, faDigits, formatJalali } from '../services/jalali';
import { localISO } from '../services/dates';
import { useStore } from '../store';
import type { Page } from '../App';

const RANGES: [RangeKind, string][] = [['7', '۷ روز'], ['30', '۳۰ روز'], ['90', '۹۰ روز'], ['month', 'این ماه']];
const TASK_COLOR = 'var(--accent)', LEARN_COLOR = '#34d399';
const TONE = { good: { icon: TrendingUp, color: '#34d399' }, warn: { icon: TrendingDown, color: '#f59e0b' }, info: { icon: Lightbulb, color: 'var(--accent)' } } as const;
const KIND_COLOR: Record<TimelineKind, string> = { task: '#8b5cf6', focus: '#38bdf8', learning: '#34d399', money: '#f59e0b', idea: '#facc15', wish: '#f472b6', daily: '#fb7185' };
const clock = (ts: number) => faDigits(new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

function Kpi({ label, value, sub, d, invert }: { label: string; value: string; sub?: string; d?: number | null; invert?: boolean }) {
  return <Card className="!p-4"><div className="text-xs muted">{label}</div><div className="text-2xl font-extrabold mt-1">{value}</div><div className="mt-1 min-h-4">{d !== undefined ? <Delta value={d} invert={invert} /> : <span className="text-[11px] muted">{sub}</span>}</div></Card>;
}

function Analysis() {
  const { data } = useStore();
  const today = localISO();
  const [kind, setKind] = useState<RangeKind>('30');
  const r = rangeFor(kind, today), pr = previousRange(kind, r);
  const stats = useMemo(() => dayStats(data), [data]);
  const cur = totals(stats, r, data.habits.length), prev = totals(stats, pr, data.habits.length);
  const buckets = focusBuckets(stats, r);
  const wd = weekdayAverages(stats, r);
  const tracks = learningByTrack(data, r), cats = categorySpend(data, r), habits = habitBreakdown(data, r, today);
  const months = monthlyFinance(data, today), notes = insights(data, kind, r, today), streak = activeStreaks(stats, today);
  const hasAny = cur.focusMin + cur.tasksDone + cur.income + cur.expense + cur.activeDays > 0;
  const best = Math.max(...wd.map(w => w.avg));
  const fmtH = (m: number) => faDigits((m / 60).toFixed(m >= 600 ? 0 : 1).replace(/\.0$/, ''));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs muted">{formatJalali(r.from)} تا {formatJalali(r.to)} · مقایسه با {formatJalali(pr.from, { year: false })} تا {formatJalali(pr.to, { year: false })}</div>
        <div className="flex gap-1" role="tablist" aria-label="بازه زمانی">{RANGES.map(([k, l]) => <button key={k} role="tab" aria-selected={kind === k} className={`btn ${kind === k ? 'btn-primary' : ''}`} onClick={() => setKind(k)}>{l}</button>)}</div>
      </div>

      {!hasAny && <Card><Empty text="در این بازه هنوز چیزی ثبت نشده. با تایمر، لاگ یادگیری یا انجام کار، اینجا پر می‌شود." /></Card>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi label="کار انجام‌شده" value={faNum(cur.tasksDone)} d={delta(cur.tasksDone, prev.tasksDone)} />
        <Kpi label="ساعت تمرکز (تایمر + یادگیری)" value={faHours(cur.focusMin)} d={delta(cur.focusMin, prev.focusMin)} />
        <Kpi label="ساعت یادگیری" value={faHours(cur.learnMin)} d={delta(cur.learnMin, prev.learnMin)} />
        <Kpi label="روز فعال" value={`${faNum(cur.activeDays)} از ${faNum(cur.days)}`} sub={streak.current ? `🔥 ${faNum(streak.current)} روز پشت‌سرهم (رکورد ${faNum(Math.max(streak.longest, streak.current))})` : `رکورد ${faNum(streak.longest)} روز`} />
        <Kpi label="خالص مالی (درآمد − هزینه)" value={money(cur.income - cur.expense)} d={undefined} sub={`درآمد ${money(cur.income)}`} />
        <Kpi label="پایبندی به عادت‌ها" value={data.habits.length ? `${faNum(cur.habitRate)}٪` : '—'} d={data.habits.length ? delta(cur.habitRate, prev.habitRate) : undefined} sub={data.habits.length ? undefined : 'عادتی تعریف نشده'} />
      </div>

      {notes.length > 0 && (
        <Card>
          <div className="flex gap-2 items-center mb-3"><Lightbulb size={18} className="accent" /><h3 className="font-bold">داده‌ها چی می‌گن؟</h3><span className="text-[11px] muted">(فقط از روی داده‌های خودت، بدون حدس)</span></div>
          <ul className="space-y-2">{notes.map((n, i) => { const T = TONE[n.tone]; return <li key={i} className="flex gap-2.5 text-sm leading-7"><T.icon size={16} className="mt-1.5 shrink-0" style={{ color: T.color }} />{n.text}</li>; })}</ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap justify-between gap-2 mb-3">
          <h3 className="font-bold flex gap-2 items-center"><Activity size={18} className="accent" />ساعت تمرکز {buckets.length > 0 && cur.days > 45 ? 'هفتگی' : 'روزانه'}</h3>
          <div className="flex gap-4 text-xs muted"><span className="flex gap-1.5 items-center"><i className="w-2.5 h-2.5 rounded" style={{ background: TASK_COLOR }} />کار (تایمر)</span><span className="flex gap-1.5 items-center"><i className="w-2.5 h-2.5 rounded" style={{ background: LEARN_COLOR }} />یادگیری</span></div>
        </div>
        {cur.focusMin > 0 ? <StackedBars data={buckets} colors={[TASK_COLOR, LEARN_COLOR]} format={m => fmtH(m)} /> : <Empty text="هنوز تمرکزی ثبت نشده؛ تایمر کار یا یادگیری را روشن کن." />}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-bold mb-1">ریتم هفته</h3><p className="text-xs muted mb-3">میانگین ساعت تمرکز در هر روز هفته</p>
          <HBars rows={wd.map(w => ({ key: w.label, label: w.label, value: w.avg, text: w.avg ? `${faHours(w.avg)} ساعت` : '—', color: w.avg === best && best > 0 ? 'var(--accent)' : undefined }))} />
        </Card>
        <Card>
          <h3 className="font-bold mb-1">یادگیری به تفکیک مسیر</h3><p className="text-xs muted mb-3">مجموع {faHours(cur.learnMin)} ساعت</p>
          <HBars rows={tracks.map(t => ({ key: t.id, label: t.title, value: t.minutes, text: `${faHours(t.minutes)} ساعت`, color: t.color }))} empty="در این بازه یادگیری ثبت نشده" />
        </Card>
        <Card>
          <h3 className="font-bold mb-1">هزینه بر اساس دسته</h3><p className="text-xs muted mb-3">مجموع {money(cur.expense)}</p>
          <HBars rows={cats.map(c => ({ key: c.category, label: c.category, value: c.amount, text: `${money(c.amount)} · ${faNum(c.share)}٪` }))} empty="در این بازه هزینه‌ای ثبت نشده" />
        </Card>
        <Card>
          <div className="flex justify-between mb-2"><h3 className="font-bold">درآمد و هزینه، ۶ ماه اخیر</h3>
            <div className="flex gap-3 text-xs muted"><span className="flex gap-1.5 items-center"><i className="w-2.5 h-2.5 rounded bg-emerald-400" />درآمد</span><span className="flex gap-1.5 items-center"><i className="w-2.5 h-2.5 rounded bg-rose-400" />هزینه</span></div></div>
          {months.some(m => m.income || m.expense) ? <GroupedBars data={months.map(m => ({ label: m.label, values: [m.income, m.expense] }))} colors={['#34d399', '#fb7185']} format={money} /> : <Empty text="تراکنشی ثبت نشده" />}
        </Card>
      </div>

      <Card>
        <h3 className="font-bold flex gap-2 items-center mb-3"><Flame size={18} className="accent" />عادت‌ها</h3>
        <HBars max={100} rows={habits.map(h => ({ key: h.id, label: h.title, value: h.rate, text: `${faNum(h.rate)}٪ (${faNum(h.done)} از ${faNum(h.days)} روز)`, sub: h.streak ? `🔥 ${faNum(h.streak)} روز پیاپی` : undefined }))} empty="هنوز عادتی تعریف نکرده‌ای (بخش سلامت)" />
      </Card>
    </div>
  );
}

function Timeline({ go }: { go: (p: Page) => void }) {
  const { data } = useStore();
  const today = localISO();
  const [kind, setKind] = useState<TimelineKind | 'all'>('all');
  const [q, setQ] = useState('');
  const [days, setDays] = useState(10);
  const all = useMemo(() => buildTimeline(data, today), [data, today]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; all.forEach(i => { c[i.kind] = (c[i.kind] ?? 0) + 1; }); return c; }, [all]);
  const filtered = all.filter(i => (kind === 'all' || i.kind === kind) && (!q.trim() || (i.title + (i.detail ?? '')).includes(q.trim())));
  const groups = groupByDay(filtered);
  const shown = groups.slice(0, days);
  const label = (d: string) => { const n = diffDays(today, d); return `${n === 0 ? 'امروز · ' : n === 1 ? 'دیروز · ' : ''}${formatJalali(d, { weekday: true })}`; };

  return (
    <div className="space-y-4">
      <Card className="!p-3 space-y-3">
        <div className="relative"><Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 muted" /><input className="field !pr-9" placeholder="جستجو در فعالیت‌ها…" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجو در فعالیت‌ها" /></div>
        <div className="flex flex-wrap gap-1.5">
          <button className={`chip ${kind === 'all' ? '!bg-[var(--accent)] !text-white' : ''}`} onClick={() => setKind('all')}>همه <span className="opacity-70 mr-1">{faNum(all.length)}</span></button>
          {(Object.keys(KIND_LABEL) as TimelineKind[]).filter(k => counts[k]).map(k => (
            <button key={k} className={`chip ${kind === k ? '!bg-[var(--accent)] !text-white' : ''}`} onClick={() => setKind(k)}><i className="w-2 h-2 rounded-full ml-1.5" style={{ background: KIND_COLOR[k] }} />{KIND_LABEL[k]} <span className="opacity-70 mr-1">{faNum(counts[k])}</span></button>
          ))}
        </div>
      </Card>

      {!shown.length && <Card><Empty text={all.length ? 'چیزی با این فیلتر پیدا نشد.' : 'هنوز فعالیتی ثبت نشده.'} /></Card>}

      {shown.map(g => (
        <section key={g.day} aria-label={label(g.day)}>
          <h3 className="text-sm font-bold mb-2 flex items-center gap-2">{label(g.day)}<span className="text-xs muted font-normal">{faNum(g.items.length)} مورد</span></h3>
          <Card className="!p-0 overflow-hidden">
            <ol>{g.items.map((i, idx) => (
              <li key={i.id} className={idx ? 'border-t' : ''} style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => go(i.page)} className="w-full flex items-center gap-3 p-3 text-right hover:bg-white/5">
                  <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0 text-sm" style={{ background: `color-mix(in srgb,${KIND_COLOR[i.kind]} 18%,transparent)`, color: KIND_COLOR[i.kind] }} aria-hidden>{i.icon}</span>
                  <span className="flex-1 min-w-0"><span className="block text-sm truncate">{i.title}</span>{i.detail && <span className="block text-xs muted truncate mt-0.5">{i.detail}</span>}</span>
                  {i.hasTime && <span className="text-[11px] muted tabular-nums shrink-0">{clock(i.ts)}</span>}
                </button>
              </li>
            ))}</ol>
          </Card>
        </section>
      ))}
      {groups.length > days && <button className="btn w-full" onClick={() => setDays(d => d + 10)}>نمایش روزهای قدیمی‌تر ({faNum(groups.length - days)} روز دیگر)</button>}
      <p className="text-xs muted">خط زمانی از روی داده‌های موجود ساخته می‌شود؛ چیزهایی که حذف کرده‌ای یا ویرایش‌های قبلی در آن نیستند.</p>
    </div>
  );
}

export default function Insights({ go }: { go: (p: Page) => void }) {
  const [tab, setTab] = useState<'analysis' | 'timeline'>('analysis');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="accent" />آمار و فعالیت</h1><p className="text-sm muted mt-1">همه‌چیز از روی داده‌های واقعی خودت محاسبه می‌شود.</p></div>
        <div className="flex gap-1" role="tablist">{([['analysis', 'تحلیل'], ['timeline', 'خط زمانی']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`btn ${tab === k ? 'btn-primary' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      </div>
      {tab === 'analysis' ? <Analysis /> : <Timeline go={go} />}
    </div>
  );
}
