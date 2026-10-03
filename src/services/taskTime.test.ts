import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import type { DB, Task } from '../types';
import { GRACE_MS, defaultDayFor, dueRings, leadOf, normalizeTime, ringKey, taskAt, whenText } from './taskTime';
import { parseQuickTask, toTask } from './quickTask';
import { planReminders } from './reminders';
import { buildAlerts } from './alerts';
import { completeTask } from './recurrence';
import { ntfyConfig } from './ntfy';

const blank = (): DB => ({ ...structuredClone(seed), tasks: [], events: [], habits: [], learning: [], wishes: [], notes: [], health: [], transactions: [], timeEntries: [], reviews: {}, timer: null, journal: [], automations: [], automationRuns: [], notices: [] });
const task = (o: Partial<Task>): Task => ({ id: 't', title: 'ورزش صبحگاهی', description: '', status: 'todo', priority: 'medium', estimate: 30, actual: 0, tags: [], subtasks: [], notes: '', createdAt: '', updatedAt: '', ...o });
const at = (h: number, m = 0, d = 1) => new Date(2026, 9, d, h, m);   // Thu 1 Oct 2026, local

describe('normalizeTime', () => {
  it.each([['7:30', '07:30'], ['07:30', '07:30'], ['7', '07:00'], ['19', '19:00'], ['۷:۳۰', '07:30'], ['٧:٣٠', '07:30'], ['23:59', '23:59'], [' 0:05 ', '00:05']])('%s → %s', (a, b) => expect(normalizeTime(a)).toBe(b));
  it.each(['24:00', '7:60', '', 'abc', '7:5', '123'])('rejects %s', a => expect(normalizeTime(a)).toBeNull());
});

describe('quick add with ^time', () => {
  const now = at(9, 0);
  it('parses explicit date + time', () => {
    const p = parseQuickTask('ورزش @فردا ^7:30 !زیاد', now);
    expect(p).toMatchObject({ title: 'ورزش', time: '07:30', due: '2026-10-02', priority: 'high' }); expect(p.dueImplied).toBeUndefined();
  });
  it('a bare time still ahead means today, a past one means tomorrow', () => {
    expect(parseQuickTask('جلسه ^18:00', now)).toMatchObject({ time: '18:00', due: '2026-10-01', dueImplied: true });
    expect(parseQuickTask('ورزش ^7:30', now)).toMatchObject({ time: '07:30', due: '2026-10-02', dueImplied: true });
  });
  it('Persian digits work and a bad time stays in the title', () => {
    expect(parseQuickTask('قرار ^۱۹:۳۰ @امروز', now).time).toBe('19:30');
    const bad = parseQuickTask('عدد ^99', now); expect(bad.title).toBe('عدد ^99'); expect(bad.time).toBeUndefined();
  });
  it('toTask keeps the time; a task without a time has none', () => {
    expect(toTask(parseQuickTask('الف @فردا ^8:15', now), now).time).toBe('08:15');
    expect(toTask(parseQuickTask('ب @فردا', now), now).time).toBeUndefined();
  });
  it('defaultDayFor is exact at the boundary', () => { expect(defaultDayFor('09:00', at(9, 0))).toBe('2026-10-02'); expect(defaultDayFor('09:01', at(9, 0))).toBe('2026-10-01'); });
});

describe('alarm rings (10 minutes before by default)', () => {
  const db = (t: Partial<Task> = {}) => ({ ...blank(), tasks: [task({ due: '2026-10-01', time: '07:30', ...t })] });
  it('rings from 10 minutes before until the grace period after', () => {
    expect(leadOf(db())).toBe(10);
    expect(dueRings(db(), at(7, 19), new Set())).toHaveLength(0);
    expect(dueRings(db(), at(7, 20), new Set())).toHaveLength(1);     // exactly 10 min before
    expect(dueRings(db(), at(7, 30), new Set())).toHaveLength(1);
    expect(dueRings(db(), new Date(at(7, 30).getTime() + GRACE_MS - 1), new Set())).toHaveLength(1);
    expect(dueRings(db(), new Date(at(7, 30).getTime() + GRACE_MS), new Set())).toHaveLength(0);   // stale: not replayed
  });
  it('does not ring again once fired, finished tasks and untimed tasks never ring', () => {
    const d = db(); const key = ringKey(d.tasks[0], 10);
    expect(dueRings(d, at(7, 25), new Set([key]))).toHaveLength(0);
    expect(dueRings(db({ status: 'done' }), at(7, 25), new Set())).toHaveLength(0);
    expect(dueRings(db({ time: undefined }), at(7, 25), new Set())).toHaveLength(0);
    expect(dueRings(db({ due: undefined }), at(7, 25), new Set())).toHaveLength(0);
  });
  it('editing the time (or the lead) re-arms the alarm', () => {
    const d = db(); const old = ringKey(d.tasks[0], 10);
    d.tasks[0].time = '08:00';
    expect(dueRings(d, at(7, 55), new Set([old]))).toHaveLength(1);
    const d2 = db(); d2.settings.taskLead = 30;
    expect(dueRings(d2, at(7, 5), new Set())).toHaveLength(1);
    expect(dueRings(d2, at(7, 5), new Set([ringKey(d2.tasks[0], 10)]))).toHaveLength(1);
  });
  it('lead 0 rings at the time itself', () => {
    const d = db(); d.settings.taskLead = 0;
    expect(dueRings(d, at(7, 29), new Set())).toHaveLength(0); expect(dueRings(d, at(7, 30), new Set())).toHaveLength(1);
  });
  it('taskAt needs both date and a valid time', () => {
    expect(taskAt({ due: '2026-10-01', time: '07:30' })).toBe(at(7, 30).getTime());
    expect(taskAt({ due: '2026-10-01', time: '7:30' })).toBeNull(); expect(taskAt({ time: '07:30' })).toBeNull();
  });
  it('whenText', () => { expect(whenText(at(7, 30).getTime(), at(7, 20).getTime())).toBe('۱۰ دقیقه دیگر'); expect(whenText(at(7, 30).getTime(), at(7, 30).getTime())).toBe('الان'); expect(whenText(at(7, 30).getTime(), at(7, 35).getTime())).toBe('۵ دقیقه پیش'); });
});

describe('bell and phone push', () => {
  const d = { ...blank(), tasks: [task({ due: '2026-10-01', time: '07:30' })] };
  it('bell: warn inside the lead, urgent after the time, silent before and long after', () => {
    const f = (now: Date) => buildAlerts(d, now).filter(a => a.id.startsWith('tt:'));
    expect(f(at(7, 0))).toHaveLength(0);
    expect(f(at(7, 22))[0]).toMatchObject({ level: 'warn' }); expect(f(at(7, 22))[0].title).toContain('۸ دقیقه دیگر');
    expect(f(at(7, 40))[0]).toMatchObject({ level: 'urgent' });
    expect(f(at(8, 10))).toHaveLength(0);
  });
  it('ntfy: one push 10 minutes before the task (only when still in the future and inside 3 days)', () => {
    const cfg = ntfyConfig({ enabled: true, topic: 'amir-os-testtopic123', digest: false, evening: false, weeklyReview: false, showTitles: true });
    const p = planReminders(d, at(6, 0), cfg).filter(x => x.id.startsWith('k-'));
    expect(p).toHaveLength(1); expect(p[0].at).toBe(at(7, 20).getTime()); expect(p[0].title).toBe('ورزش صبحگاهی'); expect(p[0].body).toContain('۱۰ دقیقه دیگر'); expect(p[0].body).toContain('۰۷:۳۰');
    expect(planReminders(d, at(7, 25), cfg).filter(x => x.id.startsWith('k-'))).toHaveLength(0);     // alarm moment already passed
    expect(planReminders({ ...d, tasks: [{ ...d.tasks[0], status: 'done' as const }] }, at(6, 0), cfg).filter(x => x.id.startsWith('k-'))).toHaveLength(0);
    expect(planReminders(d, at(6, 0), { ...cfg, events: false }).filter(x => x.id.startsWith('k-'))).toHaveLength(0);
  });
  it('ntfy: titles are hidden when the privacy switch is off; digest lists tasks in time order', () => {
    const cfg = ntfyConfig({ enabled: true, topic: 'amir-os-testtopic123', showTitles: false });
    expect(planReminders(d, at(6, 0), cfg).find(x => x.id.startsWith('k-'))!.title).toBe('کار ساعت‌دار');
    const two = { ...blank(), tasks: [task({ id: 'b', title: 'دوم', due: '2026-10-01', time: '15:00' }), task({ id: 'a', title: 'اول', due: '2026-10-01', time: '07:30' }), task({ id: 'c', title: 'بدون ساعت', due: '2026-10-01' })] };
    const digest = planReminders(two, at(6, 0), ntfyConfig({ enabled: true, topic: 'amir-os-testtopic123', showTitles: true })).find(x => x.id.endsWith('-digest'))!;
    expect(digest.body.split('\n').filter(l => l.startsWith('•'))).toEqual(['• ۰۷:۳۰ اول', '• ۱۵:۰۰ دوم', '• بدون ساعت']);
  });
});

describe('recurring tasks keep their time', () => {
  it('the next occurrence has the same time of day', () => {
    const d = { ...blank(), tasks: [task({ id: 'r', due: '2026-10-01', time: '07:30', recurring: 'daily' })] };
    const next = completeTask(d, 'r', at(8, 0)).tasks.find(t => t.status === 'todo')!;
    expect(next).toMatchObject({ due: '2026-10-02', time: '07:30' });
  });
});
