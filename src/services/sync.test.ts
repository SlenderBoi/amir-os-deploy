import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import type { DB, Task } from '../types';
import { DEFAULT_PATH, decryptState, encryptState, makePairLink, mergeStates, newSecret, pairToConfig, parsePair, plan, readEnvelope } from './sync';

const task = (id: string, title = id): Task => ({ ...(seed.tasks[0] as Task), id, title });
const db = (over: Partial<DB> = {}): DB => ({ ...structuredClone(seed), tasks: [], ...over });

describe('sync crypto', () => {
  it('round-trips the whole state and never stores plain text', async () => {
    const d = db({ tasks: [task('a', 'کار محرمانه ۱۲۳')] });
    const text = await encryptState(d, newSecret(), 'dev1').catch(e => { throw e; });
    expect(text).not.toContain('محرمانه');
    expect(readEnvelope(text).device).toBe('dev1');
  });
  it('decrypts with the right secret and rejects a wrong one', async () => {
    const secret = newSecret(); const d = db({ tasks: [task('a', 'سلام')] });
    const text = await encryptState(d, secret, 'x');
    expect((await decryptState(text, secret)).db.tasks[0].title).toBe('سلام');
    await expect(decryptState(text, newSecret())).rejects.toMatchObject({ kind: 'key' });
    const e = JSON.parse(text); e.ct = e.ct.slice(0, -8) + 'AAAAAAAA';
    await expect(decryptState(JSON.stringify(e), secret)).rejects.toMatchObject({ kind: 'key' });
  });
  it('uses fresh salt and iv each time', async () => {
    const s = newSecret(); const a = JSON.parse(await encryptState(db(), s, 'x')), b = JSON.parse(await encryptState(db(), s, 'x'));
    expect(a.salt).not.toBe(b.salt); expect(a.iv).not.toBe(b.iv); expect(a.ct).not.toBe(b.ct);
  });
  it('secrets are long, grouped and unique', () => {
    const a = newSecret(); expect(a).toMatch(/^([a-z2-9]{5}-){4}[a-z2-9]{5}$/); expect(newSecret()).not.toBe(a);
  });
  it('rejects a file that is not ours', () => { expect(() => readEnvelope('{"hello":1}')).toThrow(); });
});

describe('pairing link', () => {
  it('carries repo, token and key and survives a round trip', () => {
    const cfg = { owner: 'amir', repo: 'data', token: 'github_pat_x_Y-z', secret: newSecret(), path: DEFAULT_PATH, device: 'd1' };
    const link = makePairLink(cfg, 'https://x.github.io/app/');
    expect(link.startsWith('https://x.github.io/app/#sync=')).toBe(true);
    const p = parsePair(link.slice(link.indexOf('#')))!;
    const back = pairToConfig(p);
    expect([back.owner, back.repo, back.token, back.secret, back.path]).toEqual(['amir', 'data', cfg.token, cfg.secret, DEFAULT_PATH]);
    expect(back.device).not.toBe('d1');
  });
  it('keeps a custom branch and path, ignores garbage', () => {
    const cfg = { owner: 'a', repo: 'b', token: 't', secret: 's', path: 'x/y.json', branch: 'dev', device: 'd' };
    const link = makePairLink(cfg, 'u'); const p = parsePair(link.slice(link.indexOf('#')))!; expect([p.p, p.b]).toEqual(['x/y.json', 'dev']);
    expect(parsePair('#sync=@@@')).toBeNull(); expect(parsePair('#other')).toBeNull(); expect(parsePair('#sync=e30')).toBeNull();
  });
});

describe('sync plan', () => {
  const base = { hasRemote: true, remoteSha: 'B', lastSha: 'A', dirty: false };
  it('uploads when there is no cloud file yet', () => expect(plan({ ...base, hasRemote: false })).toBe('init-push'));
  it('asks the user the first time a cloud copy already exists', () => expect(plan({ ...base, lastSha: undefined })).toBe('conflict'));
  it('does nothing when both are in sync, pushes local edits', () => {
    expect(plan({ ...base, remoteSha: 'A' })).toBe('idle'); expect(plan({ ...base, remoteSha: 'A', dirty: true })).toBe('push');
  });
  it('pulls when only the cloud changed, asks when both changed', () => {
    expect(plan(base)).toBe('pull'); expect(plan({ ...base, dirty: true })).toBe('conflict');
  });
});

describe('merge', () => {
  it('keeps records from both sides, local wins on the same id', () => {
    const l = db({ tasks: [task('1', 'local'), task('2')] }), r = db({ tasks: [task('1', 'remote'), task('3')] });
    const m = mergeStates(l, r);
    expect(m.tasks.map(t => t.id).sort()).toEqual(['1', '2', '3']);
    expect(m.tasks.find(t => t.id === '1')!.title).toBe('local');
  });
  it('never loses coins, best scores or owned shop items', () => {
    const l = db(), r = db();
    l.settings.arcade = { best: { doodle: 50, hunt: 10 }, meatSpent: 2, buffs: 1, plays: 3, coins: 20 };
    r.settings.arcade = { best: { doodle: 30, jinn: 99 }, meatSpent: 5, buffs: 0, plays: 9, coins: 70 };
    l.settings.shop = { spent: 40, owned: ['skin:fire'], skin: 'fire', acc: {}, room: 'forest' };
    r.settings.shop = { spent: 100, owned: ['room:city'], skin: 'neon', acc: { head: 'x' }, room: 'city' };
    const m = mergeStates(l, r);
    expect(m.settings.arcade).toEqual({ best: { doodle: 50, hunt: 10, jinn: 99 }, meatSpent: 5, buffs: 1, plays: 9, coins: 70 });
    expect(m.settings.shop!.spent).toBe(100);
    expect(m.settings.shop!.owned.sort()).toEqual(['room:city', 'skin:fire']);
    expect(m.settings.shop!.skin).toBe('fire'); // look = this device's choice
  });
  it('does not touch the inputs', () => {
    const l = db({ tasks: [task('1')] }), r = db({ tasks: [task('2')] }); const before = JSON.stringify([l, r]);
    mergeStates(l, r); expect(JSON.stringify([l, r])).toBe(before);
  });
});
