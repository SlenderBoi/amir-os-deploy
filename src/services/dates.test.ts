import { describe, expect, it } from 'vitest';
import { localISO } from './dates';

describe('localISO', () => {
  it('uses the local calendar day, not the UTC day', () => {
    const lateNight = new Date(2026, 9, 1, 0, 30); // 00:30 local time
    expect(localISO(lateNight)).toBe('2026-10-01');
  });
  it('pads month and day', () => expect(localISO(new Date(2026, 0, 5, 12))).toBe('2026-01-05'));
});
