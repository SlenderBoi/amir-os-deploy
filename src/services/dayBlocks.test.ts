import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import { dayBlocks, layout, toMin } from './dayBlocks';
import type { Event, Task } from '../types';

const ev = (o: Partial<Event>): Event => ({ id: 'e', title: 'جلسه', date: '2026-10-03', start: '10:00', end: '11:00', kind: 'work', ...o } as Event);
const tk = (o: Partial<Task>): Task => ({ ...(seed.tasks[0] ?? {}), id: 't', title: 'کار', due: '2026-10-03', time: '10:30', estimate: 0, status: 'todo', priority: 'high', ...o } as Task);

describe('day blocks', () => {
  it('parses clock times strictly', () => { expect(toMin('09:05')).toBe(545); expect(toMin('24:00')).toBeNull(); expect(toMin('x')).toBeNull(); });
  it('puts events and timed tasks of that day only, tasks default to 30 min', () => {
    const b = dayBlocks({ events: [ev({}), ev({ id: 'o', date: '2026-10-04' })], tasks: [tk({}), tk({ id: 'n', time: undefined }), tk({ id: 'a', status: 'archived' }), tk({ id: 'x', due: '2026-10-05' })] }, '2026-10-03');
    expect(b.map(x => x.id).sort()).toEqual(['e-e', 't-t']);
    const t = b.find(x => x.kind === 'task')!; expect(t.end - t.start).toBe(30);
  });
  it('uses the estimate as duration and repairs bad event ends', () => {
    const b = dayBlocks({ events: [ev({ start: '12:00', end: '11:00' })], tasks: [tk({ estimate: 90 })] }, '2026-10-03');
    expect(b.find(x => x.kind === 'event')!.end).toBe(12 * 60 + 30);
    expect(b.find(x => x.kind === 'task')!.end - 630).toBe(90);
  });
  it('overlapping blocks get separate columns, later blocks reset', () => {
    const base = { kind: 'event' as const, title: '', color: '', done: false };
    const out = layout([{ ...base, id: 'a', start: 60, end: 120 }, { ...base, id: 'b', start: 90, end: 150 }, { ...base, id: 'c', start: 200, end: 230 }]);
    const g = Object.fromEntries(out.map(x => [x.id, x]));
    expect([g.a.col, g.b.col, g.a.cols, g.b.cols]).toEqual([0, 1, 2, 2]);
    expect([g.c.col, g.c.cols]).toEqual([0, 1]);
  });
});
