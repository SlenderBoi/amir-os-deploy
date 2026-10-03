import { describe, expect, it } from 'vitest';
import { parseQuickTask, toTask } from './quickTask';

const now = new Date(2026, 9, 1, 10); // 2026-10-01 local

describe('parseQuickTask', () => {
  it('parses a plain title', () => expect(parseQuickTask('خرید نان', now)).toMatchObject({ title: 'خرید نان', priority: 'medium', tags: [], subtasks: [] }));
  it('reads priority, tags, due and estimate in any order', () => {
    const p = parseQuickTask('~45 ساخت لندینگ #کار !فوری @فردا #کار', now);
    expect(p).toMatchObject({ title: 'ساخت لندینگ', priority: 'urgent', due: '2026-10-02', estimate: 45, tags: ['کار'] });
  });
  it('splits subtasks on ">" and keeps tokens from any segment', () => {
    const p = parseQuickTask('سفر > رزرو هتل > بلیط !زیاد', now);
    expect(p).toMatchObject({ title: 'سفر', subtasks: ['رزرو هتل', 'بلیط'], priority: 'high' });
  });
  it('understands Persian digits, hours and relative days', () => {
    expect(parseQuickTask('x ~۱.۵h @+۳', now)).toMatchObject({ estimate: 90, due: '2026-10-04' });
    expect(parseQuickTask('x @پس‌فردا', now).due).toBe('2026-10-03');
  });
  it('does not swallow normal words or unknown @tokens', () => expect(parseQuickTask('ایمیل به @علی فردا', now).title).toBe('ایمیل به @علی فردا'));
  it('sends dated tasks to todo and undated ones to the inbox', () => {
    expect(toTask(parseQuickTask('a @امروز', now), now).status).toBe('todo');
    expect(toTask(parseQuickTask('a', now), now).status).toBe('inbox');
  });
  it('understands Jalali dates (either separator, Persian digits) and Gregorian ISO dates', () => {
    expect(parseQuickTask('a @1405/07/20', now).due).toBe('2026-10-12');
    expect(parseQuickTask('a @۱۴۰۵-۷-۲۰', now).due).toBe('2026-10-12');
    expect(parseQuickTask('a @2026-10-12', now).due).toBe('2026-10-12');
    const bad = parseQuickTask('a @1405/07/31', now);       // Mehr has 30 days → not a date, stays in the title
    expect(bad.due).toBeUndefined(); expect(bad.title).toContain('@');
  });
});
