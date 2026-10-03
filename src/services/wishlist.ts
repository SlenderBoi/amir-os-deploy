import type { DB, LearningTrack, Priority, Transaction, WishCategory, WishItem } from '../types';
import { localISO } from './dates';
import { jalaliMonthRange } from './jalali';

/** Categories whose progress is counted in units, with the unit's label. */
export const UNIT: Partial<Record<WishCategory, string>> = { series: 'قسمت', anime: 'قسمت', book: 'صفحه', course: 'درس', game: 'ساعت' };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** 0..100. Priority: done → unit progress → savings progress → the manual slider. */
export function progressOf(w: WishItem): number {
  if (w.status === 'done') return 100;
  if (w.total && w.total > 0 && w.current !== undefined) return clamp(Math.round((w.current / w.total) * 100), 0, 100);
  if (w.category === 'purchase' && w.price && w.price > 0 && w.saved) return clamp(Math.round((w.saved / w.price) * 100), 0, 100);
  return clamp(w.progress, 0, 100);
}

/** Moves a tracked item forward (or back with a negative step). Starting flips it to "doing"; reaching the total finishes it. */
export function advance(w: WishItem, by = 1, now: Date = new Date()): WishItem {
  const max = w.total && w.total > 0 ? w.total : Number.POSITIVE_INFINITY;
  const current = clamp((w.current ?? 0) + by, 0, max);
  const next: WishItem = { ...w, current };
  if (current >= max) return { ...next, status: 'done', progress: 100, completedAt: now.toISOString() };
  if (current > 0 && (w.status === 'wanted' || w.status === 'planned' || w.status === 'done')) {
    return { ...next, status: 'doing', completedAt: undefined };
  }
  return next;
}

export const purchaseExpense = (w: WishItem, now: Date = new Date()): Transaction => ({
  id: crypto.randomUUID(), title: `خرید: ${w.title}`, amount: w.price ?? 0, type: 'expense', date: localISO(now),
  category: 'خرید', notes: 'ثبت‌شده از ویش‌لیست', recurring: false, paid: true, createdAt: now.toISOString(),
});

/**
 * Toggles done/not-done. Finishing a priced purchase can record the expense in Finance; undoing removes
 * exactly that transaction again, so the two modules never drift apart.
 */
export function toggleDone(db: DB, wishId: string, recordExpense: boolean, now: Date = new Date()): DB {
  const w = db.wishes.find(x => x.id === wishId);
  if (!w) return db;
  if (w.status === 'done') {
    const restored: WishItem = { ...w, status: (w.current ?? 0) > 0 ? 'doing' : 'wanted', completedAt: undefined, boughtTransactionId: undefined, rating: undefined, progress: 0 };
    return {
      ...db,
      wishes: db.wishes.map(x => x.id === wishId ? restored : x),
      transactions: w.boughtTransactionId ? db.transactions.filter(t => t.id !== w.boughtTransactionId) : db.transactions,
    };
  }
  const expense = recordExpense && w.category === 'purchase' && w.price && w.price > 0 ? purchaseExpense(w, now) : undefined;
  const finished: WishItem = {
    ...w, status: 'done', progress: 100, completedAt: now.toISOString(), boughtTransactionId: expense?.id,
    current: w.total ? w.total : w.current, saved: w.category === 'purchase' && w.price ? w.price : w.saved,
  };
  return { ...db, wishes: db.wishes.map(x => x.id === wishId ? finished : x), transactions: expense ? [expense, ...db.transactions] : db.transactions };
}

const WEIGHT: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

/** Weighted random pick among things you still want to do ("what should I watch tonight?"). `rnd` is injectable for tests. */
export function pickRandom(list: WishItem[], rnd: () => number = Math.random): WishItem | undefined {
  const pool = list.filter(w => w.status === 'wanted' || w.status === 'planned' || w.status === 'doing');
  const total = pool.reduce((a, w) => a + WEIGHT[w.priority], 0);
  if (!total) return undefined;
  let r = rnd() * total;
  for (const w of pool) { r -= WEIGHT[w.priority]; if (r < 0) return w; }
  return pool[pool.length - 1];
}

export interface WishStats { waiting: number; doing: number; doneThisMonth: number; remainingCost: number }

export function wishlistStats(wishes: WishItem[], now: Date = new Date()): WishStats {
  const month = jalaliMonthRange(localISO(now));
  const open = wishes.filter(w => w.status === 'wanted' || w.status === 'planned' || w.status === 'doing');
  return {
    waiting: wishes.filter(w => w.status === 'wanted' || w.status === 'planned').length,
    doing: wishes.filter(w => w.status === 'doing').length,
    doneThisMonth: wishes.filter(w => w.status === 'done' && w.completedAt && localISO(new Date(w.completedAt)) >= month.from && localISO(new Date(w.completedAt)) <= month.to).length,
    remainingCost: open.filter(w => w.category === 'purchase' && w.price).reduce((a, w) => a + Math.max(0, (w.price ?? 0) - (w.saved ?? 0)), 0),
  };
}

/** A course/book becomes a learning track (its link becomes the first resource). */
export function wishToTrack(w: WishItem, now: Date = new Date()): LearningTrack {
  return {
    id: crypto.randomUUID(), title: w.title, description: w.notes, color: '#8b5cf6', status: 'active', goalHours: 20,
    tags: w.tags, resources: [{ id: crypto.randomUUID(), title: w.title, url: w.url || undefined, done: false }], logs: [], createdAt: now.toISOString(),
  };
}

/** Only render covers we can trust: our own downscaled uploads, or plain https images. */
export const isSafeCover = (src?: string): src is string => !!src && (/^data:image\/(jpeg|png|webp);base64,/.test(src) || /^https:\/\//.test(src));
