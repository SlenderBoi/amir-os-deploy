import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import { advance, isSafeCover, pickRandom, progressOf, toggleDone, wishlistStats, wishToTrack } from './wishlist';
import type { DB, WishItem } from '../types';

const wish = (over: Partial<WishItem> = {}): WishItem => ({ id: 'w', title: 'x', category: 'series', status: 'wanted', priority: 'medium', notes: '', progress: 0, tags: [], createdAt: '', ...over });
const dbWith = (wishes: WishItem[]): DB => ({ ...structuredClone(seed), wishes, transactions: [] });
const now = new Date(2026, 9, 1, 12);

describe('progress', () => {
  it('uses units, then savings, then the manual slider; done is always 100', () => {
    expect(progressOf(wish({ current: 3, total: 12 }))).toBe(25);
    expect(progressOf(wish({ category: 'purchase', price: 8_000_000, saved: 2_000_000 }))).toBe(25);
    expect(progressOf(wish({ progress: 40 }))).toBe(40);
    expect(progressOf(wish({ status: 'done', progress: 0 }))).toBe(100);
    expect(progressOf(wish({ current: 99, total: 10 }))).toBe(100);
  });
  it('first episode starts it, last episode finishes it, undo steps back', () => {
    let w = advance(wish({ total: 2 }), 1, now);
    expect(w).toMatchObject({ current: 1, status: 'doing' });
    w = advance(w, 1, now);
    expect(w).toMatchObject({ current: 2, status: 'done', progress: 100 });
    expect(advance(w, -1, now)).toMatchObject({ current: 1, status: 'doing', completedAt: undefined });
    expect(advance(wish(), -1, now).current).toBe(0);
  });
});

describe('finishing a purchase', () => {
  const buy = wish({ id: 'b', category: 'purchase', price: 5_000_000, saved: 1_000_000 });
  it('records an expense in Finance and undo removes exactly that expense', () => {
    const done = toggleDone(dbWith([buy]), 'b', true, now);
    expect(done.wishes[0]).toMatchObject({ status: 'done', saved: 5_000_000 });
    expect(done.transactions).toHaveLength(1);
    expect(done.transactions[0]).toMatchObject({ type: 'expense', amount: 5_000_000, date: '2026-10-01', category: 'خرید' });
    expect(done.wishes[0].boughtTransactionId).toBe(done.transactions[0].id);
    const undone = toggleDone(done, 'b', false, now);
    expect(undone.transactions).toHaveLength(0);
    expect(undone.wishes[0]).toMatchObject({ status: 'wanted', boughtTransactionId: undefined });
  });
  it('does not touch Finance when the user declines, or when it is not a purchase', () => {
    expect(toggleDone(dbWith([buy]), 'b', false, now).transactions).toHaveLength(0);
    expect(toggleDone(dbWith([wish({ id: 'm', category: 'movie', price: 10 })]), 'm', true, now).transactions).toHaveLength(0);
  });
});

describe('random pick and stats', () => {
  const list = [wish({ id: 'a', priority: 'low' }), wish({ id: 'b', priority: 'urgent' }), wish({ id: 'c', status: 'done' })];
  it('never picks finished items and respects priority weights (1 vs 4)', () => {
    expect(pickRandom(list, () => 0)?.id).toBe('a');
    expect(pickRandom(list, () => 0.19)?.id).toBe('a');
    expect(pickRandom(list, () => 0.21)?.id).toBe('b');
    expect(pickRandom([wish({ status: 'done' })])).toBeUndefined();
  });
  it('counts waiting/doing/done-this-month and the remaining cost net of savings', () => {
    const s = wishlistStats([
      wish({ id: '1' }), wish({ id: '2', status: 'doing' }),
      wish({ id: '3', status: 'done', completedAt: new Date(2026, 9, 1).toISOString() }),
      wish({ id: '4', status: 'done', completedAt: new Date(2026, 8, 1).toISOString() }),
      wish({ id: '5', category: 'purchase', price: 8_000_000, saved: 3_000_000 }),
    ], now);
    expect(s).toEqual({ waiting: 2, doing: 1, doneThisMonth: 1, remainingCost: 5_000_000 });
  });
});

describe('helpers', () => {
  it('turns a course into a learning track with its link as a resource', () => {
    const t = wishToTrack(wish({ category: 'course', title: 'Python', url: 'https://x.dev', tags: ['code'] }), now);
    expect(t).toMatchObject({ title: 'Python', status: 'active', tags: ['code'] });
    expect(t.resources[0]).toMatchObject({ title: 'Python', url: 'https://x.dev', done: false });
  });
  it('only trusts safe cover sources', () => {
    expect(isSafeCover('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(isSafeCover('https://a.b/c.jpg')).toBe(true);
    expect(isSafeCover('javascript:alert(1)')).toBe(false);
    expect(isSafeCover('http://insecure.test/a.jpg')).toBe(false);
    expect(isSafeCover(undefined)).toBe(false);
  });
});
