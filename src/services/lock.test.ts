import { describe, expect, it } from 'vitest';
import { afterAttempt, createLock, lockoutMs, normalizeSecret, validateSecret, verifySecret, waitLeft } from './lock';

describe('app lock', () => {
  it('accepts Persian digits as the same PIN', () => expect(normalizeSecret('۱۲۳۴')).toBe('1234'));
  it('validates PIN and password shapes', () => {
    expect(validateSecret('123', 'pin')).not.toBeNull();
    expect(validateSecret('1234', 'pin')).toBeNull();
    expect(validateSecret('۱۲۳۴۵۶', 'pin')).toBeNull();
    expect(validateSecret('12345678', 'pin')).toBeNull();
    expect(validateSecret('123456789', 'pin')).not.toBeNull();
    expect(validateSecret('abc12', 'password')).not.toBeNull();
    expect(validateSecret('abc123', 'password')).toBeNull();
    expect(validateSecret('12ab', 'pin')).not.toBeNull();
  });
  it('stores only a salted hash and verifies correctly', async () => {
    const c = await createLock('4321', 'pin', 5);
    expect(JSON.stringify(c)).not.toContain('4321');
    expect(await verifySecret(c, '4321')).toBe(true);
    expect(await verifySecret(c, '۴۳۲۱')).toBe(true);
    expect(await verifySecret(c, '4322')).toBe(false);
    const d = await createLock('4321', 'pin', 5);
    expect(d.salt).not.toBe(c.salt);
    expect(d.hash).not.toBe(c.hash);
  });
  it('locks out after repeated wrong guesses and resets on success', async () => {
    const c = await createLock('1234', 'pin', 0);
    let x = c, t = 1_000_000;
    for (let i = 0; i < 4; i++) { x = afterAttempt(x, false, t); expect(waitLeft(x, t)).toBe(0); }
    x = afterAttempt(x, false, t);
    expect(waitLeft(x, t)).toBe(30_000);
    x = afterAttempt(x, false, t);
    expect(waitLeft(x, t)).toBe(60_000);
    expect(lockoutMs(50)).toBe(15 * 60_000);
    expect(afterAttempt(x, true, t)).toMatchObject({ fails: 0, until: 0 });
  });
});
