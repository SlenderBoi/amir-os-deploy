import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Zap, Sparkles, X } from 'lucide-react';
import { Card, Empty, Modal, faNum } from '../ui';
import { useStore } from '../store';
import { localISO } from '../services/dates';
import { WEEKDAYS, faDigits, formatJalali } from '../services/jalali';
import { ALLOWED_ACTIONS, PRIORITY_FA, describeRule, previewRule, validateRule } from '../services/automation';
import type { AutoAction, AutoTrigger, Automation, Priority } from '../types';

type Draft = Pick<Automation, 'name' | 'trigger' | 'actions' | 'enabled'> & { id?: string };

const TRIGGER_LABEL: Record<AutoTrigger['kind'], string> = {
  overdue: 'کاری عقب افتاد', done: 'کاری انجام شد', daily: 'هر روز در ساعت…', weekly: 'هر هفته در روز و ساعت…', habit_missed: 'عادتی چند روز انجام نشد', spend: 'هزینهٔ ماه از مبلغی گذشت',
};
const ACTION_LABEL: Record<AutoAction['kind'], string> = { priority: 'اولویت کار را تغییر بده', tag: 'برچسب بزن', reschedule: 'موعد را جابه‌جا کن', create_task: 'کار تازه بساز', notify: 'اعلان بده (در زنگ)' };
const DEFAULT_TRIGGER: Record<AutoTrigger['kind'], AutoTrigger> = {
  overdue: { kind: 'overdue', days: 3 }, done: { kind: 'done' }, daily: { kind: 'daily', time: '08:00' }, weekly: { kind: 'weekly', weekday: 6, time: '17:00' },
  habit_missed: { kind: 'habit_missed', days: 3 }, spend: { kind: 'spend', category: '', amount: 5_000_000 },
};
const DEFAULT_ACTION: Record<AutoAction['kind'], AutoAction> = {
  priority: { kind: 'priority', to: 'high' }, tag: { kind: 'tag', tag: 'عقب‌افتاده' }, reschedule: { kind: 'reschedule', to: 'today' },
  create_task: { kind: 'create_task', title: '', due: 'today', priority: 'medium' }, notify: { kind: 'notify', title: '' },
};

const TEMPLATES: { title: string; hint: string; rule: Draft }[] = [
  { title: 'عقب‌افتاده‌ها را جدی بگیر', hint: 'کاری ۳ روز عقب افتاد ← اولویت زیاد + برچسب',
    rule: { name: 'عقب‌افتاده‌ها', enabled: true, trigger: { kind: 'overdue', days: 3 }, actions: [{ kind: 'priority', to: 'high' }, { kind: 'tag', tag: 'عقب‌افتاده' }] } },
  { title: 'مرور هفتگی جمعه', hint: 'هر جمعه ۱۷:۰۰ ← یک کار «مرور هفته» بساز',
    rule: { name: 'مرور هفتگی', enabled: true, trigger: { kind: 'weekly', weekday: 6, time: '17:00' }, actions: [{ kind: 'create_task', title: 'مرور هفته و برنامهٔ هفتهٔ بعد', due: 'today', priority: 'medium' }] } },
  { title: 'عادت از دست رفت', hint: 'عادتی ۳ روز انجام نشد ← اعلان',
    rule: { name: 'عادت‌های رهاشده', enabled: true, trigger: { kind: 'habit_missed', days: 3 }, actions: [{ kind: 'notify', title: 'عادت «{habit}» {days} روز است انجام نشده', body: 'امروز فقط یک بار، کوچیک.' }] } },
  { title: 'سقف هزینه', hint: 'هزینهٔ ماه شمسی از ۵ میلیون گذشت ← اعلان',
    rule: { name: 'سقف هزینهٔ ماه', enabled: true, trigger: { kind: 'spend', category: '', amount: 5_000_000 }, actions: [{ kind: 'notify', title: 'هزینهٔ این ماه به {amount} رسید' }] } },
  { title: 'پیگیری بعد از تمام‌شدن', hint: 'کاری با برچسب «مشتری» تمام شد ← کار پیگیری بساز',
    rule: { name: 'پیگیری مشتری', enabled: true, trigger: { kind: 'done', tag: 'مشتری' }, actions: [{ kind: 'create_task', title: 'پیگیری: {title}', due: 'tomorrow', priority: 'medium' }] } },
];

const when = (iso: string) => `${formatJalali(localISO(new Date(iso)), { year: false })} · ${faDigits(new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}`;

export default function AutomationPage() {
  const { data, setData } = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const rules = data.automations;
  const stats = useMemo(() => {
    const m = new Map<string, { count: number; last?: string }>();
    for (const r of data.automationRuns) { const s = m.get(r.ruleId) ?? { count: 0 }; s.count++; if (!s.last || r.at > s.last) s.last = r.at; m.set(r.ruleId, s); }
    return m;
  }, [data.automationRuns]);
  const log = [...data.automationRuns].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);

  const toggle = (id: string) => setData(d => ({ ...d, automations: d.automations.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a) }));
  const remove = (a: Automation) => { if (confirm(`قانون «${a.name}» حذف شود؟ (تاریخچهٔ اجرای آن هم پاک می‌شود)`)) setData(d => ({ ...d, automations: d.automations.filter(x => x.id !== a.id), automationRuns: d.automationRuns.filter(r => r.ruleId !== a.id) })); };
  const save = (x: Draft) => setData(d => {
    const prev = x.id ? d.automations.find(a => a.id === x.id) : undefined;
    if (!prev) return { ...d, automations: [...d.automations, { id: crypto.randomUUID(), name: x.name.trim(), enabled: x.enabled, trigger: x.trigger, actions: x.actions, createdAt: new Date().toISOString() }] };
    // a changed condition starts from a clean slate; a renamed or re-actioned rule must not replay old subjects
    const triggerChanged = JSON.stringify(prev.trigger) !== JSON.stringify(x.trigger);
    return {
      ...d,
      automations: d.automations.map(a => a.id === prev.id ? { ...a, name: x.name.trim(), enabled: x.enabled, trigger: x.trigger, actions: x.actions, createdAt: triggerChanged ? new Date().toISOString() : a.createdAt } : a),
      automationRuns: triggerChanged ? d.automationRuns.filter(r => r.ruleId !== prev.id) : d.automationRuns,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="accent" />اتوماسیون</h1>
          <p className="text-sm muted mt-1">«اگر این شد، این کار را بکن». قانون‌ها فقط وقتی برنامه باز است اجرا می‌شوند.</p></div>
        <button className="btn btn-primary" onClick={() => setDraft({ name: '', enabled: true, trigger: DEFAULT_TRIGGER.overdue, actions: [DEFAULT_ACTION.priority] })}><Plus size={16} />قانون جدید</button>
      </div>

      {rules.length === 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-1 font-bold"><Sparkles size={16} className="accent" />شروع سریع</div>
          <p className="text-xs muted mb-3">یکی را انتخاب کن؛ قبل از ذخیره می‌توانی عوضش کنی و ببینی الان روی چند مورد اجرا می‌شود.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {TEMPLATES.map(t => <button key={t.title} className="text-right rounded-xl p-3 hover:bg-white/5 border" style={{ borderColor: 'var(--border)' }} onClick={() => setDraft(structuredClone(t.rule))}><div className="font-bold text-sm">{t.title}</div><div className="text-xs muted mt-1">{t.hint}</div></button>)}
          </div>
        </Card>
      )}

      <div className="space-y-3" aria-label="قانون‌ها">
        {rules.map(a => {
          const s = stats.get(a.id), bad = validateRule(a);
          return (
            <Card key={a.id} className="!p-4">
              <div className="flex items-start gap-3">
                <button role="switch" aria-checked={a.enabled} aria-label={`فعال بودن «${a.name}»`} onClick={() => toggle(a.id)} className="mt-1 w-11 h-6 rounded-full relative shrink-0 transition" style={{ background: a.enabled ? 'var(--accent)' : 'var(--panel2)', border: '1px solid var(--border)' }}>
                  <i className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ right: a.enabled ? 2 : 'auto', left: a.enabled ? 'auto' : 2 }} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{a.name}</div>
                  <div className="text-sm muted mt-1 leading-7">{describeRule(a)}</div>
                  <div className="text-xs muted mt-1">{s ? `${faNum(s.count)} بار اجرا شده · آخرین: ${when(s.last!)}` : a.enabled ? 'هنوز اجرا نشده' : 'خاموش'}{bad && <span className="text-rose-400"> · {bad}</span>}</div>
                </div>
                <div className="flex gap-1">
                  <button className="btn !p-2" aria-label={`ویرایش «${a.name}»`} onClick={() => setDraft({ id: a.id, name: a.name, enabled: a.enabled, trigger: a.trigger, actions: a.actions })}><Pencil size={15} /></button>
                  <button className="btn !p-2" aria-label={`حذف «${a.name}»`} onClick={() => remove(a)}><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <h3 className="font-bold mb-3">تاریخچهٔ اجرا</h3>
        {log.length === 0 ? <Empty text="هنوز هیچ قانونی اجرا نشده." /> : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }} aria-label="تاریخچهٔ اجرا">
            {log.map(r => <li key={r.id} className="py-2 text-sm flex flex-wrap gap-x-3 justify-between"><span><b>{r.ruleName}</b> <span className="muted">— {r.summary}</span></span><span className="text-xs muted">{when(r.at)}</span></li>)}
          </ul>
        )}
      </Card>

      <p className="text-xs muted leading-6">محدودیت‌ها: بدون سرور، قانون‌ها فقط وقتی برنامه (یا تب آن) باز است بررسی می‌شوند؛ هنگام باز شدن، چیزهایی که جا مانده‌اند اجرا می‌شوند، ولی زمان‌بندی‌های روزانه/هفتگی فقط برای «امروز» جبران می‌شوند. هر قانون برای هر کار/روز/عادت فقط یک بار اجرا می‌شود. اعلان‌ها در زنگ برنامه می‌آیند؛ برای اعلان روی گوشی از تنظیمات ntfy استفاده کن.</p>

      {draft && <RuleEditor draft={draft} onClose={() => setDraft(null)} onSave={x => { save(x); setDraft(null); }} />}
    </div>
  );
}

function RuleEditor({ draft, onClose, onSave }: { draft: Draft; onClose: () => void; onSave: (d: Draft) => void }) {
  const { data } = useStore();
  const [x, setX] = useState<Draft>(draft);
  const [touched, setTouched] = useState(false);
  const err = validateRule(x);
  const t = x.trigger;
  const cats = [...new Set(data.transactions.filter(y => y.type === 'expense').map(y => y.category))];
  const allowed = ALLOWED_ACTIONS[t.kind];
  const setTrigger = (trigger: AutoTrigger) => setX(p => ({ ...p, trigger, actions: p.actions.filter(a => ALLOWED_ACTIONS[trigger.kind].includes(a.kind)).length ? p.actions.filter(a => ALLOWED_ACTIONS[trigger.kind].includes(a.kind)) : [DEFAULT_ACTION[ALLOWED_ACTIONS[trigger.kind][0]]] }));
  const setAction = (i: number, a: AutoAction) => setX(p => ({ ...p, actions: p.actions.map((o, j) => j === i ? a : o) }));
  const preview = useMemo(() => err ? null : previewRule(data, { id: x.id ?? 'preview', name: x.name, enabled: true, trigger: x.trigger, actions: x.actions, createdAt: x.id ? (data.automations.find(a => a.id === x.id)?.createdAt ?? new Date().toISOString()) : new Date().toISOString() }), [data, x, err]);
  const vars = t.kind === 'overdue' ? '{title} {days}' : t.kind === 'done' ? '{title}' : t.kind === 'habit_missed' ? '{habit} {days}' : t.kind === 'spend' ? '{category} {amount}' : '';

  return (
    <Modal title={draft.id ? 'ویرایش قانون' : 'قانون جدید'} onClose={onClose} wide>
      <div className="p-4 space-y-4">
        <label className="block text-sm">اسم قانون<input className="field mt-1" value={x.name} onChange={e => setX({ ...x, name: e.target.value })} placeholder="مثلاً: عقب‌افتاده‌ها" aria-label="اسم قانون" /></label>

        <fieldset className="rounded-xl p-3 space-y-3 border" style={{ borderColor: 'var(--border)' }}>
          <legend className="text-xs muted px-1">وقتی…</legend>
          <select className="field" value={t.kind} aria-label="شرط" onChange={e => setTrigger(DEFAULT_TRIGGER[e.target.value as AutoTrigger['kind']])}>
            {(Object.keys(TRIGGER_LABEL) as AutoTrigger['kind'][]).map(k => <option key={k} value={k}>{TRIGGER_LABEL[k]}</option>)}
          </select>
          {(t.kind === 'overdue' || t.kind === 'habit_missed') && <label className="flex items-center gap-2 text-sm">حداقل<input type="number" min={1} max={365} className="field !w-24" aria-label="تعداد روز" value={t.days} onChange={e => setTrigger({ ...t, days: Math.round(+e.target.value) })} />روز</label>}
          {t.kind === 'done' && <label className="block text-sm">فقط با برچسب (اختیاری)<input className="field mt-1" value={t.tag ?? ''} onChange={e => setTrigger({ kind: 'done', tag: e.target.value || undefined })} aria-label="برچسب" /></label>}
          {(t.kind === 'daily' || t.kind === 'weekly') && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {t.kind === 'weekly' && <select className="field !w-36" aria-label="روز هفته" value={t.weekday} onChange={e => setTrigger({ ...t, weekday: +e.target.value })}>{WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}</select>}
              <input type="time" dir="ltr" className="field !w-32" aria-label="ساعت" value={t.time} onChange={e => setTrigger({ ...t, time: e.target.value })} />
            </div>
          )}
          {t.kind === 'spend' && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input className="field !w-44" list="auto-cats" placeholder="همهٔ دسته‌ها" aria-label="دستهٔ هزینه" value={t.category} onChange={e => setTrigger({ ...t, category: e.target.value })} />
              <datalist id="auto-cats">{cats.map(c => <option key={c} value={c} />)}</datalist>
              از<input type="number" min={1} className="field !w-40" aria-label="مبلغ" value={t.amount} onChange={e => setTrigger({ ...t, amount: +e.target.value })} />{data.settings.currency} بیشتر شد
            </div>
          )}
        </fieldset>

        <fieldset className="rounded-xl p-3 space-y-3 border" style={{ borderColor: 'var(--border)' }}>
          <legend className="text-xs muted px-1">آن‌وقت…</legend>
          {x.actions.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg p-2" style={{ background: 'var(--panel2)' }}>
              <select className="field !w-52" aria-label={`کار ${faNum(i + 1)}`} value={a.kind} onChange={e => setAction(i, DEFAULT_ACTION[e.target.value as AutoAction['kind']])}>
                {allowed.map(k => <option key={k} value={k}>{ACTION_LABEL[k]}</option>)}
              </select>
              {a.kind === 'priority' && <select className="field !w-32" aria-label="اولویت" value={a.to} onChange={e => setAction(i, { ...a, to: e.target.value as Priority })}>{(Object.keys(PRIORITY_FA) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_FA[p]}</option>)}</select>}
              {a.kind === 'tag' && <input className="field !w-40" aria-label="برچسب" value={a.tag} onChange={e => setAction(i, { ...a, tag: e.target.value })} />}
              {a.kind === 'reschedule' && <select className="field !w-32" aria-label="موعد جدید" value={a.to} onChange={e => setAction(i, { ...a, to: e.target.value as 'today' | 'tomorrow' })}><option value="today">امروز</option><option value="tomorrow">فردا</option></select>}
              {a.kind === 'create_task' && <>
                <input className="field flex-1 min-w-48" placeholder="عنوان کار" aria-label="عنوان کار" value={a.title} onChange={e => setAction(i, { ...a, title: e.target.value })} />
                <select className="field !w-28" aria-label="موعد کار" value={a.due} onChange={e => setAction(i, { ...a, due: e.target.value as 'today' | 'tomorrow' | 'none' })}><option value="today">امروز</option><option value="tomorrow">فردا</option><option value="none">بدون موعد</option></select>
                <select className="field !w-28" aria-label="اولویت کار" value={a.priority} onChange={e => setAction(i, { ...a, priority: e.target.value as Priority })}>{(Object.keys(PRIORITY_FA) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_FA[p]}</option>)}</select>
              </>}
              {a.kind === 'notify' && <>
                <input className="field flex-1 min-w-48" placeholder="متن اعلان" aria-label="متن اعلان" value={a.title} onChange={e => setAction(i, { ...a, title: e.target.value })} />
                <input className="field flex-1 min-w-40" placeholder="توضیح (اختیاری)" aria-label="توضیح اعلان" value={a.body ?? ''} onChange={e => setAction(i, { ...a, body: e.target.value || undefined })} />
              </>}
              {x.actions.length > 1 && <button className="btn !p-1.5" aria-label="حذف این کار" onClick={() => setX({ ...x, actions: x.actions.filter((_, j) => j !== i) })}><X size={14} /></button>}
            </div>
          ))}
          <button className="btn text-xs" onClick={() => setX({ ...x, actions: [...x.actions, DEFAULT_ACTION[allowed.find(k => !x.actions.some(a => a.kind === k)) ?? allowed[allowed.length - 1]]] })}><Plus size={14} />کار دیگر</button>
          {vars && <p className="text-[11px] muted">در متن‌ها می‌توانی از این‌ها استفاده کنی: <bdi dir="ltr">{vars}</bdi></p>}
        </fieldset>

        <div className="text-sm rounded-xl p-3" style={{ background: 'var(--panel2)' }} aria-live="polite">
          <div className="text-xs muted mb-1">خلاصه</div>
          {err ? <span className={touched ? 'text-rose-400' : 'muted'}>{err}</span> : <>
            <div className="leading-7">{describeRule(x)}</div>
            <div className="text-xs mt-2" data-testid="preview">{preview!.length === 0 ? 'الان روی هیچ موردی اجرا نمی‌شود.' : <>اگر الان ذخیره و روشن شود، <b>{faNum(preview!.length)} مورد</b> اجرا می‌شود: {preview!.slice(0, 3).map(r => r.summary).join(' | ')}{preview!.length > 3 ? ' …' : ''}</>}</div>
          </>}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={x.enabled} onChange={e => setX({ ...x, enabled: e.target.checked })} />روشن باشد</label>
          <div className="flex gap-2"><button className="btn" onClick={onClose}>انصراف</button><button className="btn btn-primary" onClick={() => { setTouched(true); if (!err) onSave(x); }}>ذخیره</button></div>
        </div>
      </div>
    </Modal>
  );
}
