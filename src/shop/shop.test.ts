import { describe, expect, it } from 'vitest';
import { seed } from '../db';
import type { DB } from '../types';
import { itemOf, ITEMS, MEAT_PACK_PRICE } from './catalog';
import { buy, buyMeat, coinBalance, coinsEarned, emptyShop, equip, isEquipped, lookOf, owns, unequip } from './rules';
import { coinsForRun, recordRun } from '../arcade/rules';
import { gameState } from '../services/game';

const db = (): DB => ({ ...structuredClone(seed), tasks: [], notes: [], wishes: [], learning: [], habits: [], journal: [], timeEntries: [] });
const I = (k: 'skin' | 'acc' | 'room', id: string) => itemOf(k, id)!;

describe('shop', () => {
  it('catalog has unique kind:id pairs and sane prices', () => {
    const keys = ITEMS.map(i => `${i.kind}:${i.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const i of ITEMS) { expect(i.price).toBeGreaterThanOrEqual(0); expect(i.level).toBeGreaterThanOrEqual(1); if (i.kind === 'acc') expect(i.slot).toBeTruthy(); }
  });
  it('coins: 1 per 5 xp plus arcade coins, minus what was spent', () => {
    expect(coinsEarned(24, 0)).toBe(4);
    const d = db(); d.settings.arcade = { best: {}, meatSpent: 0, buffs: 0, plays: 0, coins: 10 }; d.settings.shop = { ...emptyShop(), spent: 6 };
    expect(coinBalance(d, 100)).toBe(24);
    d.settings.shop.spent = 999;
    expect(coinBalance(d, 100)).toBe(0);
  });
  it('buying checks level, coins and duplicates; free items are always owned', () => {
    expect(buy(undefined, I('skin', 'gold'), 1000, 1)).toMatchObject({ ok: false });
    expect(buy(undefined, I('skin', 'fire'), 10, 1)).toMatchObject({ ok: false });
    const r = buy(undefined, I('skin', 'fire'), 50, 1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.shop.spent).toBe(40);
      expect(owns(r.shop, I('skin', 'fire'))).toBe(true);
      expect(buy(r.shop, I('skin', 'fire'), 500, 9)).toMatchObject({ ok: false });
    }
    expect(owns(undefined, I('skin', 'neon'))).toBe(true);
    expect(owns(undefined, I('room', 'forest'))).toBe(true);
    expect(owns(undefined, I('skin', 'fire'))).toBe(false);
  });
  it('same id as skin and room are different products', () => {
    const r = buy(undefined, I('skin', 'forest'), 500, 5);
    expect(r.ok && owns(r.shop, I('room', 'forest'))).toBe(true); // free room
    expect(r.ok && owns(r.shop, I('skin', 'forest'))).toBe(true);
    expect(owns(undefined, I('skin', 'forest'))).toBe(false);
  });
  it('equip only works for owned items; accessories use slots', () => {
    expect(equip(undefined, I('skin', 'fire')).skin).toBe('neon');
    let s = buy(undefined, I('acc', 'sunglasses'), 100, 1); if (!s.ok) throw new Error();
    let sh = equip(s.shop, I('acc', 'sunglasses'));
    expect(sh.acc.face).toBe('sunglasses');
    expect(isEquipped(sh, I('acc', 'sunglasses'))).toBe(true);
    sh = unequip(sh, 'face');
    expect(sh.acc.face).toBeUndefined();
  });
  it('lookOf falls back for unknown ids', () => {
    expect(lookOf({ ...emptyShop(), skin: 'zzz', room: 'nope', acc: { head: 'ghost-hat' } })).toEqual({ skin: 'neon', room: 'forest', acc: {} });
  });
  it('special meat costs coins and gives a capped buff', () => {
    const d = db();
    expect(buyMeat(d, MEAT_PACK_PRICE - 1)).toBeNull();
    const r = buyMeat(d, 50)!;
    expect(r.shop.spent).toBe(MEAT_PACK_PRICE);
    expect(r.arcade).toMatchObject({ buffs: 1, meatSpent: 0 });
    d.settings.arcade = { best: {}, meatSpent: 0, buffs: 3, plays: 0 };
    expect(buyMeat(d, 50)).toBeNull();
  });
  it('arcade runs pay capped coins and gameState exposes the balance', () => {
    expect(coinsForRun(0)).toBe(0); expect(coinsForRun(80)).toBe(10); expect(coinsForRun(9999)).toBe(25);
    const d = db();
    d.settings.arcade = recordRun(undefined, 'doodle', 160).arcade;
    expect(d.settings.arcade.coins).toBe(20);
    expect(gameState(d, new Date(2026, 9, 3, 12)).coins).toBe(20);
  });
});
