import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import type { AutoAction, AutoTrigger, Automation, DB, Habit, Task } from '../types';
import { MAX_FIRES_PER_PASS, describeRule, previewRule, runAutomations, validateRule, weekdayIndex } from './automation';
import { buildAlerts } from './alerts';

const blank = (): DB => ({ ...structuredClone(seed), tasks: [], events: [], habits: [], learning: [], wishes: [], notes: [], health: [], transactions: [], timeEntries: [], reviews: {}, timer: null, journal: [], automations: [], automationRuns: [], notices: [] });
const task = (o: Partial<Task>): Task => ({ id: 't', title: 'کار', description: '', status: 'todo', priority: 'low', estimate: 30, actual: 0, tags: [], subtasks: [], notes: '', createdAt: '', updatedAt: '', ...o });
const rule = (trigger: AutoTrigger, actions: AutoAction[], o: Partial<Automation> = {}): Automation => ({ id: 'r1', name: 'قانون', enabled: true, trigger, actions, createdAt: '2026-09-01T00:00:00', ...o });
const NOW = new Date(2026, 9, 1, 14, 0);   // Thu 1 Oct 2026, 14:00 local
const withRule = (db: DB, r: Automation) => ({ ...db, automations: [r] });

describe('overdue trigger', () => {
  const db = withRule({ ...blank(), tasks: [task({ id: 'a', due: '2026-09-27' }), task({ id: 'b', due: '2026-09-30' }), task({ id: 'c', due: '2026-09-20', status: 'done' }), task({ id: 'd' })] },
    rule({ kind: 'overdue', days: 3 }, [{ kind: 'priority', to: 'high' }, { kind: 'tag', tag: 'عقب‌افتاده' }]));
  it('acts only on open tasks that are at least N days late', () => {
    const r = runAutomations(db, NOW);
    expect(r.runs).toHaveLength(1);
    const t = r.db.tasks.find(x => x.id === 'a')!;
    expect(t.priority).toBe('high'); expect(t.tags).toEqual(['عقب‌افتاده']);
    expect(r.db.tasks.find(x => x.id === 'b')!.priority).toBe('low');   // only 1 day late
    expect(r.db.tasks.find(x => x.id === 'c')!.priority).toBe('low');   // done
  });
  it('is idempotent: a second pass changes nothing and returns the same object', () => {
    const once = runAutomations(db, NOW).db;
    const twice = runAutomations(once, NOW);
    expect(twice.runs).toEqual([]); expect(twice.db).toBe(once);
  });
  it('fires again for the same task only if its due date changed and it is late again', () => {
    const once = runAutomations(db, NOW).db;
    const moved = { ...once, tasks: once.tasks.map(t => t.id === 'a' ? { ...t, due: '2026-09-24' } : t) };
    expect(runAutomations(moved, NOW).runs).toHaveLength(1);
  });
  it('disabled rules do nothing', () => {
    expect(runAutomations({ ...db, automations: [{ ...db.automations[0], enabled: false }] }, NOW).runs).toEqual([]);
  });
  it('reschedule moves the due date and the task is no longer overdue', () => {
    const d = withRule({ ...blank(), tasks: [task({ id: 'a', due: '2026-09-20' })] }, rule({ kind: 'overdue', days: 1 }, [{ kind: 'reschedule', to: 'tomorrow' }]));
    expect(runAutomations(d, NOW).db.tasks[0].due).toBe('2026-10-02');
  });
});

describe('done trigger', () => {
  const mk = (completedAt: string, tags: string[]) => task({ id: completedAt, status: 'done', completedAt, tags, title: 'طراحی لوگو' });
  const d = withRule({ ...blank(), tasks: [mk('2026-08-01T10:00:00', ['مشتری']), mk('2026-10-01T12:00:00', ['مشتری']), mk('2026-10-01T12:30:00', ['شخصی'])] },
    rule({ kind: 'done', tag: 'مشتری' }, [{ kind: 'create_task', title: 'پیگیری: {title}', due: 'tomorrow', priority: 'medium' }]));
  it('only reacts to tasks finished after the rule was created and matching the tag; fills {title}', () => {
    const r = runAutomations(d, NOW);
    expect(r.runs).toHaveLength(1);
    const made = r.db.tasks.find(t => t.title.startsWith('پیگیری'))!;
    expect(made.title).toBe('پیگیری: طراحی لوگو'); expect(made.due).toBe('2026-10-02'); expect(made.tags).toContain('خودکار');
  });
  it('a follow-up task created by the rule does not trigger anything itself', () => {
    const once = runAutomations(d, NOW).db;
    expect(runAutomations(once, NOW).runs).toEqual([]);
  });
});

describe('time triggers', () => {
  const daily = rule({ kind: 'daily', time: '08:00' }, [{ kind: 'notify', title: 'صبح بخیر' }]);
  it('daily: fires once after the time, never before, never twice in a day', () => {
    const db = withRule(blank(), daily);
    expect(runAutomations(db, new Date(2026, 9, 1, 7, 59)).runs).toHaveLength(0);
    const r = runAutomations(db, new Date(2026, 9, 1, 8, 1));
    expect(r.runs).toHaveLength(1); expect(r.db.notices[0].title).toBe('صبح بخیر');
    expect(runAutomations(r.db, new Date(2026, 9, 1, 20, 0)).runs).toHaveLength(0);
    expect(runAutomations(r.db, new Date(2026, 9, 2, 8, 5)).runs).toHaveLength(1);   // next day fires again
  });
  it('a rule created at 14:00 does not fire for today’s 08:00', () => {
    const db = withRule(blank(), { ...daily, createdAt: new Date(2026, 9, 1, 14, 0).toISOString() });
    expect(runAutomations(db, new Date(2026, 9, 1, 15, 0)).runs).toHaveLength(0);
    expect(runAutomations(db, new Date(2026, 9, 2, 8, 1)).runs).toHaveLength(1);
  });
  it('weekly: only on the chosen weekday (Saturday-first index)', () => {
    expect(weekdayIndex('2026-10-01')).toBe(5);   // Thursday
    expect(weekdayIndex('2026-10-02')).toBe(6);   // Friday
    const db = withRule(blank(), rule({ kind: 'weekly', weekday: 6, time: '17:00' }, [{ kind: 'notify', title: 'x' }]));
    expect(runAutomations(db, new Date(2026, 9, 1, 18, 0)).runs).toHaveLength(0);
    expect(runAutomations(db, new Date(2026, 9, 2, 18, 0)).runs).toHaveLength(1);
  });
});

describe('habit and spend triggers', () => {
  it('habit missed N days fires once per miss-streak and skips habits that never started', () => {
    const habits: Habit[] = [
      { id: 'a', title: 'ورزش', target: 1, unit: '', color: '', entries: { '2026-09-25': 1 } },
      { id: 'b', title: 'مطالعه', target: 1, unit: '', color: '', entries: { '2026-09-30': 1 } },
      { id: 'c', title: 'تازه', target: 1, unit: '', color: '', entries: {} },
    ];
    const db = withRule({ ...blank(), habits }, rule({ kind: 'habit_missed', days: 3 }, [{ kind: 'notify', title: '{habit} {days}' }]));
    const r = runAutomations(db, NOW);
    expect(r.db.notices.map(n => n.title)).toEqual(['ورزش ۳']);
    expect(runAutomations(r.db, new Date(2026, 9, 3, 9, 0)).runs).toHaveLength(0);
  });
  it('spend: uses the Jalali month so far, optional category, fires once per month', () => {
    const tx = (id: string, amount: number, date: string, category: string) => ({ id, title: '', amount, type: 'expense' as const, date, category, notes: '', recurring: false, paid: true, createdAt: '' });
    const base = { ...blank(), transactions: [tx('1', 600, '2026-09-24', 'خوراک'), tx('2', 600, '2026-09-10', 'خوراک'), tx('3', 900, '2026-09-25', 'خرید')] };   // 1 Mehr = 2026-09-23
    const hit = runAutomations(withRule(base, rule({ kind: 'spend', category: 'خوراک', amount: 1000 }, [{ kind: 'notify', title: '{category}: {amount}' }])), NOW);
    expect(hit.runs).toHaveLength(0);   // the 10 Sep expense belongs to Shahrivar
    const all = runAutomations(withRule(base, rule({ kind: 'spend', category: '', amount: 1500 }, [{ kind: 'notify', title: '{amount}' }])), NOW);
    expect(all.runs).toHaveLength(1); expect(all.db.notices[0].title).toBe('۱,۵۰۰');
    expect(runAutomations(all.db, NOW).runs).toHaveLength(0);
  });
});

describe('safety', () => {
  it('caps how much one pass can do; the rest follows on the next pass without duplicates', () => {
    const tasks = Array.from({ length: 40 }, (_, i) => task({ id: `t${i}`, due: '2026-09-01' }));
    const db = withRule({ ...blank(), tasks }, rule({ kind: 'overdue', days: 1 }, [{ kind: 'tag', tag: 'x' }]));
    const p1 = runAutomations(db, NOW); expect(p1.runs).toHaveLength(MAX_FIRES_PER_PASS);
    const p2 = runAutomations(p1.db, NOW); expect(p2.runs).toHaveLength(40 - MAX_FIRES_PER_PASS);
    expect(runAutomations(p2.db, NOW).runs).toHaveLength(0);
    expect(p2.db.tasks.every(t => t.tags.length === 1)).toBe(true);
  });
  it('preview reports what would fire and changes nothing', () => {
    const db = { ...blank(), tasks: [task({ id: 'a', due: '2026-09-20' })] };
    const before = JSON.stringify(db);
    const r = previewRule(db, rule({ kind: 'overdue', days: 2 }, [{ kind: 'priority', to: 'urgent' }]), NOW);
    expect(r).toHaveLength(1); expect(r[0].summary).toContain('فوری'); expect(JSON.stringify(db)).toBe(before);
  });
  it('a rule whose action cannot apply to its trigger is rejected', () => {
    expect(validateRule(rule({ kind: 'daily', time: '08:00' }, [{ kind: 'priority', to: 'high' }]))).toBeTruthy();
    expect(validateRule(rule({ kind: 'overdue', days: 0 }, [{ kind: 'tag', tag: 'x' }]))).toBeTruthy();
    expect(validateRule(rule({ kind: 'daily', time: '25:00' }, [{ kind: 'notify', title: 'x' }]))).toBeTruthy();
    expect(validateRule(rule({ kind: 'daily', time: '08:00' }, [{ kind: 'notify', title: ' ' }]))).toBeTruthy();
    expect(validateRule(rule({ kind: 'overdue', days: 3 }, [{ kind: 'tag', tag: 'x' }]))).toBeNull();
  });
  it('describes a rule in plain Persian', () => {
    expect(describeRule(rule({ kind: 'weekly', weekday: 6, time: '17:00' }, [{ kind: 'notify', title: 'مرور' }]))).toBe('هر جمعه ساعت ۱۷:۰۰ ← اعلان «مرور» بده');
  });
  it('notices from rules show up in the bell for a week, then go away', () => {
    const db = { ...blank(), notices: [{ id: 'n1', at: new Date(2026, 9, 1, 8, 0).toISOString(), title: 'سلام', page: 'tasks' as const, ruleId: 'r1' }] };
    expect(buildAlerts(db, NOW).some(a => a.id === 'notice:n1')).toBe(true);
    expect(buildAlerts(db, new Date(2026, 9, 10, 14, 0)).some(a => a.id === 'notice:n1')).toBe(false);
  });
});
