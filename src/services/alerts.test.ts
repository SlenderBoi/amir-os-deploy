import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import type { DB, Task } from '../types';
import { buildAlerts, pruneDismissed } from './alerts';
import { emptyEntry } from './journal';

const blank = (): DB => ({ ...structuredClone(seed), tasks: [], events: [], habits: [], learning: [], wishes: [], notes: [], health: [], transactions: [], timeEntries: [], reviews: {}, timer: null, journal: [] });
const task = (o: Partial<Task>): Task => ({ id: 't', title: 'کار', description: '', status: 'todo', priority: 'medium', estimate: 30, actual: 0, tags: [], subtasks: [], notes: '', createdAt: '', updatedAt: '', ...o });
const at = (h: number, m = 0, d = 1) => new Date(2026, 9, d, h, m);   // Thu 1 Oct 2026 (local)
const ids = (db: DB, now: Date) => buildAlerts(db, now).map(a => a.id.split(':')[0]);

describe('buildAlerts', () => {
  it('says nothing about an empty, calm afternoon', () => {
    expect(buildAlerts(blank(), at(14))).toEqual([]);
  });
  it('overdue is urgent and sorts first; due-today comes next; finished and archived tasks are ignored', () => {
    const db = blank();
    db.tasks = [task({ id: '1', title: 'قدیمی', due: '2026-09-25' }), task({ id: '2', due: '2026-10-01' }), task({ id: '3', due: '2026-09-01', status: 'done' }), task({ id: '4', due: '2026-09-01', status: 'archived' })];
    const a = buildAlerts(db, at(14));
    expect(a.map(x => x.level)).toEqual(['urgent', 'warn']);
    expect(a[0].title).toContain('۱ کار عقب‌افتاده'); expect(a[0].detail).toContain('قدیمی');
    expect(a[1].title).toContain('۱ کار برای امروز');
  });
  it('the id changes with the count, so a new overdue task shows up as new again', () => {
    const db = blank(); db.tasks = [task({ due: '2026-09-25' })];
    const before = buildAlerts(db, at(14))[0].id;
    db.tasks.push(task({ id: 'u', due: '2026-09-26' }));
    expect(buildAlerts(db, at(14))[0].id).not.toBe(before);
  });
  it('events: "soon" within two hours, "now" while running, nothing later or already over', () => {
    const db = blank();
    const ev = (id: string, start: string, end: string) => ({ id, title: id, date: '2026-10-01', start, end, kind: 'work' as const, createdAt: '' });
    db.events = [ev('soon', '15:30', '16:00'), ev('now', '14:00', '15:00'), ev('late', '19:00', '20:00'), ev('over', '09:00', '10:00')];
    const a = buildAlerts(db, at(14, 30));
    expect(a.map(x => x.id.split(':')[3]).sort()).toEqual(['now', 'soon']);
    expect(a.find(x => x.id.endsWith(':soon'))!.title).toContain('۶۰ دقیقهٔ دیگر');
  });
  it('forgotten timer only after 3 hours', () => {
    const db = blank(); db.timer = { kind: 'task', refId: 'x', label: 'گزارش', startedAt: at(10).toISOString() };
    expect(ids(db, at(12))).not.toContain('timer');
    expect(ids(db, at(14))).toContain('timer');
  });
  it('morning nudge until noon and only without priorities; evening nudges from 18:00', () => {
    const db = blank(); db.habits = [{ id: 'h', title: 'ورزش', target: 1, unit: '', color: '', entries: {} }];
    expect(ids(db, at(9))).toContain('plan'); expect(ids(db, at(13))).not.toContain('plan');
    expect(ids(db, at(14))).not.toContain('habits');
    expect(ids(db, at(19))).toEqual(expect.arrayContaining(['habits', 'reflect']));
    db.habits[0].entries['2026-10-01'] = 1;
    expect(ids(db, at(19))).not.toContain('habits');
    db.journal = [{ ...emptyEntry('2026-10-01'), intentions: [{ id: 'i', text: 'x', done: false }], wins: 'خوب بود' }];
    expect(ids(db, at(9))).not.toContain('plan'); expect(ids(db, at(19))).not.toContain('reflect');
  });
  it('evening reflection still nags if only priorities were written (no reflection text)', () => {
    const db = blank(); db.journal = [{ ...emptyEntry('2026-10-01'), intentions: [{ id: 'i', text: 'x', done: false }] }];
    expect(ids(db, at(20))).toContain('reflect');
  });
  it('Friday suggests the weekly review; open debts are counted, paid ones are not', () => {
    const db = blank();
    expect(ids(db, at(14, 0, 2))).toContain('review');
    const tx = (paid: boolean) => ({ id: String(paid), title: '', amount: 5, type: 'debt' as const, date: '2026-09-01', category: '', notes: '', recurring: false, paid, createdAt: '' });
    db.transactions = [tx(false), tx(true)];
    expect(buildAlerts(db, at(14)).find(a => a.id.startsWith('debt'))!.title).toContain('۱ مطالبهٔ باز');
  });
  it('is deterministic for the same data and clock', () => {
    const db = blank(); db.tasks = [task({ due: '2026-09-25' })];
    expect(buildAlerts(db, at(14))).toEqual(buildAlerts(db, at(14)));
  });
});

describe('pruneDismissed', () => {
  it('dedupes and keeps the newest', () => {
    expect(pruneDismissed(['a', 'b', 'a', 'c'], 2)).toEqual(['b', 'c']);
  });
});
