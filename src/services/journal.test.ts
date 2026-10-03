import { describe, expect, it } from 'vitest';
import type { DailyLog } from '../types';
import { seed } from '../db';
import { emptyEntry, intentionDone, isEmptyEntry, journalStreak, onThisDay, saveEntry, searchJournal, snippet, taskFromIntention } from './journal';

const page = (date: string, o: Partial<DailyLog> = {}): DailyLog => ({ ...emptyEntry(date), ...o });

describe('saveEntry', () => {
  it('one page per date: saving again replaces, never duplicates', () => {
    let j = saveEntry([], page('2026-10-01', { wins: 'الف' }));
    j = saveEntry(j, { ...j[0], wins: 'ب' });
    expect(j).toHaveLength(1); expect(j[0].wins).toBe('ب');
  });
  it('a page with nothing in it is removed, whitespace counts as nothing', () => {
    expect(isEmptyEntry(page('2026-10-01', { wins: '   \n' }))).toBe(true);
    const j = saveEntry([page('2026-10-01', { wins: 'x' })], page('2026-10-01', { wins: '  ' }));
    expect(j).toEqual([]);
  });
  it('an intention alone makes a page; blank intentions are dropped on save', () => {
    const e = page('2026-10-01', { intentions: [{ id: '1', text: 'ورزش', done: false }, { id: '2', text: ' ', done: false }] });
    expect(saveEntry([], e)[0].intentions.map(i => i.text)).toEqual(['ورزش']);
  });
  it('does not touch other days', () => {
    const j = saveEntry([page('2026-09-30', { note: 'دیروز' })], page('2026-10-01', { note: 'امروز' }));
    expect(j.map(e => e.date).sort()).toEqual(['2026-09-30', '2026-10-01']);
  });
});

describe('intentions', () => {
  const db = { ...structuredClone(seed), tasks: [] as any[] };
  it('done when ticked, or when the linked task is finished', () => {
    const i = { id: 'a', text: 'x', done: false, taskId: 't1' };
    expect(intentionDone(db, i)).toBe(false);
    db.tasks = [{ id: 't1', status: 'doing' }];
    expect(intentionDone(db, i)).toBe(false);
    db.tasks = [{ id: 't1', status: 'done' }];
    expect(intentionDone(db, i)).toBe(true);
    expect(intentionDone(db, { id: 'b', text: 'y', done: true })).toBe(true);
  });
  it('a task made from an intention is due that day', () => {
    const t = taskFromIntention({ id: 'a', text: ' خرید ', done: false }, '2026-10-05');
    expect(t).toMatchObject({ title: 'خرید', due: '2026-10-05', status: 'todo' });
  });
});

describe('streak, echoes, search', () => {
  const days = ['2026-10-01', '2026-09-30', '2026-09-29', '2026-09-20', '2026-09-19'];
  const j = days.map(d => page(d, { note: `n ${d}` }));
  it('counts back from today', () => { expect(journalStreak(j, '2026-10-01')).toEqual({ current: 3, longest: 3 }); });
  it('an unwritten today does not break yesterday’s streak yet', () => { expect(journalStreak(j, '2026-10-02')).toEqual({ current: 3, longest: 3 }); });
  it('pages written ahead for tomorrow do not count', () => { expect(journalStreak([...j, page('2026-10-02', { note: 'برنامه' })], '2026-10-01')).toEqual({ current: 3, longest: 3 }); });
  it('a gap of a day does', () => { expect(journalStreak(j, '2026-10-03').current).toBe(0); });
  it('finds pages from a week, a month and a year ago', () => {
    const all = [page('2026-09-24', { note: 'a' }), page('2026-09-01', { note: 'b' }), page('2025-10-01', { note: 'c' }), page('2026-09-25', { note: 'no' })];
    expect(onThisDay(all, '2026-10-01').map(x => x.ago)).toEqual([7, 30, 365]);
  });
  it('search matches any text field and intentions, newest first', () => {
    const all = [page('2026-09-01', { gratitude: 'قهوهٔ صبح' }), page('2026-09-10', { intentions: [{ id: '1', text: 'قهوه بخر', done: false }] }), page('2026-09-12', { note: 'هیچی' })];
    expect(searchJournal(all, 'قهوه').map(e => e.date)).toEqual(['2026-09-10', '2026-09-01']);
    expect(searchJournal(all, '')).toHaveLength(3);
  });
  it('snippet takes the first non-empty field and truncates', () => {
    expect(snippet(page('d', { note: 'x'.repeat(200) }), 20)).toHaveLength(20);
    expect(snippet(page('d', { improve: 'دوم' }))).toBe('دوم');
  });
});
