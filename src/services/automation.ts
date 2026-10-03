import type { AutoAction, AutoTrigger, Automation, AutomationRun, DB, Notice, Priority, Task } from '../types';
import { addDaysISO, diffDays, faDigits, jalaliMonthRange, WEEKDAYS } from './jalali';
import { localISO } from './dates';

/**
 * Automation engine. It is a pure function: (data, clock) → (new data, what fired).
 * Every firing is written to a ledger keyed by (rule, subject), so a rule can never fire twice for
 * the same task / day / habit, no matter how often the engine runs or how many times the app reopens.
 * It only runs while the app is open (see useAutomations); there is no server.
 */
export const MAX_FIRES_PER_PASS = 25;
export const LEDGER_LIMIT = 3000;
const NOTICE_LIMIT = 60;

export const PRIORITY_FA: Record<Priority, string> = { low: 'کم', medium: 'متوسط', high: 'زیاد', urgent: 'فوری' };
const n = faDigits;
const norm = (s: string) => s.trim().toLowerCase();
const okTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const weekdayIndex = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return (new Date(y, m - 1, d).getDay() + 1) % 7; };   // 0 = Saturday

/** Which actions make sense for which trigger (task actions need a task to act on). */
const TASK_TRIGGERS = ['overdue', 'done'] as const;
export const ALLOWED_ACTIONS: Record<AutoTrigger['kind'], AutoAction['kind'][]> = {
  overdue: ['priority', 'tag', 'reschedule', 'create_task', 'notify'],
  done: ['tag', 'create_task', 'notify'],
  daily: ['create_task', 'notify'],
  weekly: ['create_task', 'notify'],
  habit_missed: ['create_task', 'notify'],
  spend: ['create_task', 'notify'],
};

export function validateRule(r: Pick<Automation, 'name' | 'trigger' | 'actions'>): string | null {
  const t = r.trigger;
  if (!r.name.trim()) return 'برای قانون یک اسم بنویس.';
  if (!r.actions.length) return 'حداقل یک کار برای انجام‌دادن اضافه کن.';
  if ((t.kind === 'overdue' || t.kind === 'habit_missed') && !(Number.isInteger(t.days) && t.days >= 1 && t.days <= 365)) return 'تعداد روز باید بین ۱ تا ۳۶۵ باشد.';
  if ((t.kind === 'daily' || t.kind === 'weekly') && !okTime(t.time)) return 'ساعت معتبر نیست (مثل 08:00).';
  if (t.kind === 'weekly' && !(Number.isInteger(t.weekday) && t.weekday >= 0 && t.weekday <= 6)) return 'روز هفته معتبر نیست.';
  if (t.kind === 'spend' && !(t.amount > 0)) return 'مبلغ باید بیشتر از صفر باشد.';
  for (const a of r.actions) {
    if (!ALLOWED_ACTIONS[t.kind].includes(a.kind)) return 'یکی از کارها با این شرط جور نیست.';
    if (a.kind === 'tag' && !a.tag.trim()) return 'برچسب خالی است.';
    if ((a.kind === 'create_task' || a.kind === 'notify') && !a.title.trim()) return 'عنوان خالی است.';
  }
  return null;
}

export function describeRule(r: Pick<Automation, 'trigger' | 'actions'>): string {
  const t = r.trigger;
  const when = t.kind === 'overdue' ? `وقتی کاری ${n(t.days)} روز یا بیشتر عقب افتاد`
    : t.kind === 'done' ? `وقتی کاری${t.tag ? ` با برچسب «${t.tag}»` : ''} انجام شد`
    : t.kind === 'daily' ? `هر روز ساعت ${n(t.time)}`
    : t.kind === 'weekly' ? `هر ${WEEKDAYS[t.weekday]} ساعت ${n(t.time)}`
    : t.kind === 'habit_missed' ? `وقتی عادتی ${n(t.days)} روز پشت‌سرهم انجام نشد`
    : `وقتی هزینهٔ ${t.category ? `«${t.category}»` : 'کل'} در این ماه شمسی به ${n(t.amount.toLocaleString('en'))} رسید`;
  const what = r.actions.map(a => a.kind === 'priority' ? `اولویتش را «${PRIORITY_FA[a.to]}» کن`
    : a.kind === 'tag' ? `برچسب «${a.tag}» بزن`
    : a.kind === 'reschedule' ? `موعدش را ${a.to === 'today' ? 'امروز' : 'فردا'} کن`
    : a.kind === 'create_task' ? `کار «${a.title}» بساز`
    : `اعلان «${a.title}» بده`).join('، ');
  return `${when} ← ${what}`;
}

interface Subject { key: string; vars: Record<string, string>; taskId?: string; page: Notice['page'] }

function subjectsFor(db: DB, rule: Automation, now: Date): Subject[] {
  const t = rule.trigger, today = localISO(now), made = Date.parse(rule.createdAt);
  const open = db.tasks.filter(x => x.status !== 'done' && x.status !== 'archived');
  switch (t.kind) {
    case 'overdue':
      return open.filter(x => x.due && diffDays(today, x.due) >= t.days)
        .map(x => ({ key: `task:${x.id}:${x.due}`, vars: { title: x.title, days: n(diffDays(today, x.due!)) }, taskId: x.id, page: 'tasks' as const }));
    case 'done':
      // only things finished after the rule was created: switching a rule on never replays history
      return db.tasks.filter(x => x.status === 'done' && x.completedAt && Date.parse(x.completedAt) >= made && Date.parse(x.completedAt) <= now.getTime() + 60_000
        && (!t.tag || x.tags.some(g => norm(g) === norm(t.tag!))))
        .map(x => ({ key: `task:${x.id}:${x.completedAt}`, vars: { title: x.title }, taskId: x.id, page: 'tasks' as const }));
    case 'daily': case 'weekly': {
      if (!okTime(t.time) || (t.kind === 'weekly' && weekdayIndex(today) !== t.weekday)) return [];
      const at = new Date(`${today}T${t.time}:00`).getTime();
      // today only: missed days are not replayed; a rule never fires for a moment before it existed
      return now.getTime() >= at && at >= made ? [{ key: `${t.kind === 'daily' ? 'day' : 'week'}:${today}`, vars: {}, page: 'dashboard' as const }] : [];
    }
    case 'habit_missed': {
      const out: Subject[] = [];
      for (const h of db.habits) {
        const met = (d: string) => (h.entries[d] ?? 0) >= h.target;
        const everDone = Object.keys(h.entries).filter(met).sort();
        if (!everDone.length) continue;   // a brand-new habit has not "missed" anything yet
        let missed = true;
        for (let i = 1; i <= t.days && missed; i++) missed = !met(addDaysISO(today, -i));
        if (missed && !met(today)) out.push({ key: `habit:${h.id}:${everDone[everDone.length - 1]}`, vars: { habit: h.title, days: n(t.days) }, page: 'health' });
      }
      return out;
    }
    case 'spend': {
      const r = jalaliMonthRange(today), cat = norm(t.category);
      const total = db.transactions.filter(x => x.type === 'expense' && x.date >= r.from && x.date <= r.to && (!cat || norm(x.category) === cat)).reduce((a, x) => a + x.amount, 0);
      return total >= t.amount ? [{ key: `spend:${cat}:${r.from}`, vars: { category: t.category || 'همه', amount: n(total.toLocaleString('en')) }, page: 'finance' as const }] : [];
    }
  }
}

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

function apply(db: DB, a: AutoAction, s: Subject, rule: Automation, now: Date): { db: DB; say?: string } {
  const today = localISO(now), iso = now.toISOString();
  const patchTask = (fn: (t: Task) => Task) => ({ ...db, tasks: db.tasks.map(t => t.id === s.taskId ? { ...fn(t), updatedAt: iso } : t) });
  const task = s.taskId ? db.tasks.find(t => t.id === s.taskId) : undefined;
  switch (a.kind) {
    case 'priority':
      if (!task || task.priority === a.to) return { db };
      return { db: patchTask(t => ({ ...t, priority: a.to })), say: `اولویت «${task.title}» شد ${PRIORITY_FA[a.to]}` };
    case 'tag':
      if (!task || task.tags.some(g => norm(g) === norm(a.tag))) return { db };
      return { db: patchTask(t => ({ ...t, tags: [...t.tags, a.tag.trim()] })), say: `برچسب «${a.tag.trim()}» روی «${task.title}»` };
    case 'reschedule': {
      if (!task) return { db };
      const due = a.to === 'today' ? today : addDaysISO(today, 1);
      return { db: patchTask(t => ({ ...t, due })), say: `موعد «${task.title}» شد ${a.to === 'today' ? 'امروز' : 'فردا'}` };
    }
    case 'create_task': {
      const title = fill(a.title, s.vars).trim();
      const due = a.due === 'none' ? undefined : a.due === 'today' ? today : addDaysISO(today, 1);
      const t: Task = { id: crypto.randomUUID(), title, description: '', status: due ? 'todo' : 'inbox', priority: a.priority, due, estimate: 30, actual: 0, tags: ['خودکار'], subtasks: [], notes: `ساخته‌شده با قانون «${rule.name}»`, createdAt: iso, updatedAt: iso };
      return { db: { ...db, tasks: [...db.tasks, t] }, say: `کار «${title}» ساخته شد` };
    }
    case 'notify': {
      const notice: Notice = { id: crypto.randomUUID(), at: iso, title: fill(a.title, s.vars), body: a.body ? fill(a.body, s.vars) : undefined, page: s.page, ruleId: rule.id };
      return { db: { ...db, notices: [...db.notices, notice].slice(-NOTICE_LIMIT) }, say: `اعلان: ${notice.title}` };
    }
  }
}

export function runAutomations(db: DB, now: Date = new Date(), only?: string): { db: DB; runs: AutomationRun[] } {
  const done = new Set(db.automationRuns.map(r => `${r.ruleId}|${r.key}`));
  const runs: AutomationRun[] = [];
  let cur = db;
  for (const rule of db.automations) {
    if (only ? rule.id !== only : !rule.enabled) continue;
    if (validateRule(rule)) continue;
    for (const s of subjectsFor(cur, rule, now)) {
      if (runs.length >= MAX_FIRES_PER_PASS) break;
      if (done.has(`${rule.id}|${s.key}`)) continue;
      const runId = crypto.randomUUID(), said: string[] = [];
      for (const a of rule.actions) { const r = apply(cur, a, s, rule, now); cur = r.db; if (r.say) said.push(r.say); }
      done.add(`${rule.id}|${s.key}`);
      runs.push({ id: runId, ruleId: rule.id, ruleName: rule.name, key: s.key, at: now.toISOString(), summary: said.join(' · ') || 'بدون تغییر (از قبل همین‌طور بود)' });
    }
  }
  if (!runs.length) return { db, runs };
  return { db: { ...cur, automationRuns: [...cur.automationRuns, ...runs].slice(-LEDGER_LIMIT) }, runs };
}

/** What would fire right now if this rule were saved and switched on (without changing anything). */
export const previewRule = (db: DB, rule: Automation, now: Date = new Date()): AutomationRun[] =>
  runAutomations({ ...db, automations: [rule] }, now, rule.id).runs;
