import { defaultDayFor, normalizeTime } from './taskTime';
import type { Priority, Task } from '../types';
import { localISO } from './dates';
import { addDays } from './srs';
import { parseJalali } from './jalali';

/**
 * Quick-capture syntax (works anywhere a task can be typed):
 *   خرید هدیه > بودجه > لیست  !فوری  #شخصی  @فردا  ~45
 *   ">" starts subtasks · "!" priority · "#" tag · "@" due date · "~" estimate (minutes, or 1.5h / 2س)
 *   "^" time of day: ^7:30 · ^19 · ^۷:۳۰ (with no @date: today if still ahead, otherwise tomorrow)
 */
export interface ParsedTask {
  title: string;
  priority: Priority;
  tags: string[];
  estimate?: number;
  due?: string;
  /** "HH:MM"; a bare time with no @date means today if still ahead, else tomorrow */
  time?: string;
  /** true when `due` was only guessed from a bare time (callers that know the day, like the calendar, should override it) */
  dueImplied?: boolean;
  subtasks: string[];
}

const PRIORITIES: Record<string, Priority> = {
  'فوری': 'urgent', urgent: 'urgent', 'زیاد': 'high', high: 'high', 'متوسط': 'medium', medium: 'medium', 'کم': 'low', low: 'low',
};
const RELATIVE_DAYS: Record<string, number> = { 'امروز': 0, today: 0, 'فردا': 1, tomorrow: 1, 'پسفردا': 2 };

const asciiDigits = (s: string) => s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export function parseQuickTask(input: string, now: Date = new Date()): ParsedTask {
  const result: ParsedTask = { title: '', priority: 'medium', tags: [], subtasks: [] };
  const today = localISO(now);

  const consume = (raw: string): boolean => {
    const token = asciiDigits(raw).replace(/\u200c/g, '');
    if (token.startsWith('!') && PRIORITIES[token.slice(1).toLowerCase()]) { result.priority = PRIORITIES[token.slice(1).toLowerCase()]; return true; }
    if (token.length > 1 && token.startsWith('#')) { result.tags.push(raw.slice(1)); return true; }
    if (token.startsWith('@')) {
      const word = token.slice(1).toLowerCase();
      if (word in RELATIVE_DAYS) { result.due = addDays(today, RELATIVE_DAYS[word]); return true; }
      if (/^\+\d+$/.test(word)) { result.due = addDays(today, Number(word.slice(1))); return true; }
      // 13xx/14xx = Jalali (1405/07/20 or 1405-7-20); anything else with dashes is a Gregorian ISO date
      const date = word.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (date) {
        const iso = Number(date[1]) < 1700 ? parseJalali(word) : /^\d{4}-\d{2}-\d{2}$/.test(word) ? word : null;
        if (iso) { result.due = iso; return true; }
        return false;
      }
      return false;
    }
    if (token.startsWith('^')) { const t = normalizeTime(token.slice(1)); if (t) { result.time = t; return true; } return false; }
    const est = token.match(/^~(\d+(?:\.\d+)?)(h|س|m|د)?$/i);
    if (est) { const n = Number(est[1]); result.estimate = Math.max(1, Math.round(/h|س/i.test(est[2] ?? '') ? n * 60 : n)); return true; }
    return false;
  };

  const [first, ...rest] = input.split(/[>›]/).map(part =>
    part.trim().split(/\s+/).filter(Boolean).filter(tok => !consume(tok)).join(' '));
  result.title = first ?? '';
  result.subtasks = rest.filter(Boolean);
  result.tags = [...new Set(result.tags)];
  if (result.time && !result.due) { result.due = defaultDayFor(result.time, now); result.dueImplied = true; }
  return result;
}

export function toTask(p: ParsedTask, now: Date = new Date()): Task {
  const iso = now.toISOString();
  return {
    id: crypto.randomUUID(), title: p.title, description: '', status: p.due ? 'todo' : 'inbox', priority: p.priority,
    due: p.due, time: p.time, estimate: p.estimate ?? 30, actual: 0, tags: p.tags,
    subtasks: p.subtasks.map(title => ({ id: crypto.randomUUID(), title, done: false })),
    notes: '', createdAt: iso, updatedAt: iso,
  };
}
