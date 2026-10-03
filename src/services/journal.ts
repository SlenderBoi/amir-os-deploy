import type { DailyLog, DB, Intention, Task } from '../types';
import { addDaysISO } from './jalali';

/** The text fields of a page, in the order they are asked. */
export const TEXT_FIELDS = ['wins', 'improve', 'gratitude', 'note'] as const;
export type TextField = typeof TEXT_FIELDS[number];

export const MAX_INTENTIONS = 5;

export function emptyEntry(date: string, now: Date = new Date()): DailyLog {
  const iso = now.toISOString();
  return { id: crypto.randomUUID(), date, intentions: [], wins: '', improve: '', gratitude: '', note: '', createdAt: iso, updatedAt: iso };
}

export const isEmptyEntry = (e: DailyLog): boolean =>
  e.intentions.every(i => !i.text.trim()) && TEXT_FIELDS.every(f => !e[f].trim());

export const entryFor = (journal: DailyLog[], date: string): DailyLog | undefined => journal.find(e => e.date === date);

/**
 * Saves a page. Pages are unique per date, and a page with nothing written in it is removed rather
 * than stored, so clearing a day really clears it.
 */
export function saveEntry(journal: DailyLog[], entry: DailyLog, now: Date = new Date()): DailyLog[] {
  const rest = journal.filter(e => e.date !== entry.date);
  if (isEmptyEntry(entry)) return rest;
  return [...rest, { ...entry, intentions: entry.intentions.filter(i => i.text.trim()), updatedAt: now.toISOString() }];
}

/** An intention counts as done when ticked, or when the task it was turned into is finished. */
export function intentionDone(db: DB, i: Intention): boolean {
  if (i.done) return true;
  return !!i.taskId && db.tasks.some(t => t.id === i.taskId && t.status === 'done');
}

export function taskFromIntention(i: Intention, date: string, now: Date = new Date()): Task {
  const iso = now.toISOString();
  return { id: crypto.randomUUID(), title: i.text.trim(), description: '', status: 'todo', priority: 'high', due: date, estimate: 30, actual: 0, tags: ['اولویت‌روز'], subtasks: [], notes: '', createdAt: iso, updatedAt: iso };
}

/** Days in a row with a page, counted back from today (an unwritten today does not break it yet). */
export function journalStreak(journal: DailyLog[], today: string): { current: number; longest: number } {
  const days = new Set(journal.map(e => e.date));
  let current = 0;
  for (let d = days.has(today) ? today : addDaysISO(today, -1); days.has(d); d = addDaysISO(d, -1)) current++;
  const sorted = [...days].filter(d => d <= today).sort();   // pages planned for tomorrow don't count yet
  let longest = 0, run = 0, prev = '';
  for (const d of sorted) { run = prev && addDaysISO(prev, 1) === d ? run + 1 : 1; longest = Math.max(longest, run); prev = d; }
  return { current, longest };
}

/** Pages written exactly a week, a month (30 days) and a year (365 days) before `date`. */
export function onThisDay(journal: DailyLog[], date: string): { ago: number; entry: DailyLog }[] {
  return [7, 30, 365].flatMap(ago => { const entry = entryFor(journal, addDaysISO(date, -ago)); return entry ? [{ ago, entry }] : []; });
}

export const snippet = (e: DailyLog, max = 90): string => {
  const text = [e.wins, e.improve, e.gratitude, e.note, ...e.intentions.map(i => i.text)].map(x => x.trim()).find(Boolean) ?? '';
  const one = text.replace(/\s+/g, ' ');
  return one.length > max ? one.slice(0, max - 1) + '…' : one;
};

export function searchJournal(journal: DailyLog[], query: string): DailyLog[] {
  const q = query.trim();
  const all = [...journal].sort((a, b) => b.date.localeCompare(a.date));
  if (!q) return all;
  return all.filter(e => [e.wins, e.improve, e.gratitude, e.note, ...e.intentions.map(i => i.text)].some(t => t.includes(q)));
}
