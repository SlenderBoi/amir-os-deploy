import type { DB, Event, Task } from '../types';

export interface Block { id: string; kind: 'event' | 'task'; title: string; start: number; end: number; color: string; done: boolean; col: number; cols: number; event?: Event; task?: Task }
const PRIORITY_COLOR: Record<Task['priority'], string> = { urgent: '#f43f5e', high: '#f59e0b', medium: '#8b5cf6', low: '#64748b' };
const EVENT_COLOR: Record<Event['kind'], string> = { work: '#8b5cf6', personal: '#22d3ee', reminder: '#f59e0b' };

export const toMin = (t: string): number | null => { const m = /^(\d{1,2}):(\d{2})$/.exec(t); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };

/** Overlapping blocks share the width: every block gets a column index and the column count of its overlap group. */
export function layout(blocks: Omit<Block, 'col' | 'cols'>[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Block[] = [];
  let group: Block[] = [], groupEnd = -1;
  const flush = () => { const cols = Math.max(1, ...group.map(b => b.col + 1)); group.forEach(b => (b.cols = cols)); out.push(...group); group = []; };
  for (const b of sorted) {
    if (group.length && b.start >= groupEnd) flush();
    const taken = new Set(group.filter(g => g.end > b.start).map(g => g.col));
    let col = 0; while (taken.has(col)) col++;
    group.push({ ...b, col, cols: 1 }); groupEnd = Math.max(groupEnd, b.end);
  }
  flush();
  return out;
}

/** Time blocks and timed tasks of one day, ready to draw on an hour grid. */
export function dayBlocks(db: Pick<DB, 'events' | 'tasks'>, iso: string): Block[] {
  const items: Omit<Block, 'col' | 'cols'>[] = [];
  for (const e of db.events) {
    if (e.date !== iso) continue;
    const s = toMin(e.start); if (s === null) continue;
    let en = toMin(e.end) ?? s + 30; if (en <= s) en = s + 30;
    items.push({ id: `e-${e.id}`, kind: 'event', title: e.title, start: s, end: en, color: EVENT_COLOR[e.kind] ?? '#8b5cf6', done: false, event: e });
  }
  for (const t of db.tasks) {
    if (t.due !== iso || !t.time || t.status === 'archived') continue;
    const s = toMin(t.time); if (s === null) continue;
    items.push({ id: `t-${t.id}`, kind: 'task', title: t.title, start: s, end: s + (t.estimate > 0 ? Math.min(t.estimate, 480) : 30), color: PRIORITY_COLOR[t.priority], done: t.status === 'done', task: t });
  }
  return layout(items);
}
