import type { DB } from '../types';
import { feedPet } from '../arcade/rules';
import { FREE, itemOf, ITEMS, MEAT_PACK_PRICE } from './catalog';
import type { Item, Slot } from './catalog';

export interface Shop { spent: number; owned: string[]; skin: string; acc: { head?: string; face?: string; neck?: string }; room: string }
export const emptyShop = (): Shop => ({ spent: 0, owned: [], skin: FREE.skin, acc: {}, room: FREE.room });
const norm = (s?: Partial<Shop>): Shop => ({ ...emptyShop(), ...s, owned: [...(s?.owned ?? [])], acc: { ...(s?.acc ?? {}) } });
const key = (it: Item) => `${it.kind}:${it.id}`;

/** 1 coin per 5 XP of real work, plus coins won in arcade runs. */
export const coinsEarned = (xpTotal: number, arcadeCoins = 0) => Math.floor(xpTotal / 5) + arcadeCoins;
export const coinBalance = (db: DB, xpTotal: number) => Math.max(0, coinsEarned(xpTotal, db.settings.arcade?.coins ?? 0) - (db.settings.shop?.spent ?? 0));

export const owns = (shop: Shop | undefined, it: Item) => it.price === 0 || norm(shop).owned.includes(key(it));

export type BuyResult = { ok: true; shop: Shop } | { ok: false; error: string };
export function buy(shop: Shop | undefined, it: Item, balance: number, level: number): BuyResult {
  const s = norm(shop);
  if (owns(s, it)) return { ok: false, error: 'قبلاً خریده‌ای' };
  if (level < it.level) return { ok: false, error: `با سطح ${it.level} باز می‌شود` };
  if (balance < it.price) return { ok: false, error: 'سکه‌ات کافی نیست' };
  return { ok: true, shop: { ...s, spent: s.spent + it.price, owned: [...s.owned, key(it)] } };
}

/** Puts an owned item on (skin/room replace, accessories take their slot). */
export function equip(shop: Shop | undefined, it: Item): Shop {
  const s = norm(shop);
  if (!owns(s, it)) return s;
  if (it.kind === 'skin') return { ...s, skin: it.id };
  if (it.kind === 'room') return { ...s, room: it.id };
  return { ...s, acc: { ...s.acc, [it.slot as Slot]: it.id } };
}
export function unequip(shop: Shop | undefined, slot: Slot): Shop { const s = norm(shop); const acc = { ...s.acc }; delete acc[slot]; return { ...s, acc }; }
export const isEquipped = (shop: Shop | undefined, it: Item): boolean => {
  const s = norm(shop);
  return it.kind === 'skin' ? s.skin === it.id : it.kind === 'room' ? s.room === it.id : s.acc[it.slot as Slot] === it.id;
};

export interface Look { skin: string; room: string; acc: { head?: string; face?: string; neck?: string } }
export function lookOf(shop: Shop | undefined): Look {
  const s = norm(shop);
  // an unknown / removed id falls back to the free look
  return {
    skin: itemOf('skin', s.skin) ? s.skin : FREE.skin, room: itemOf('room', s.room) ? s.room : FREE.room,
    acc: Object.fromEntries(Object.entries(s.acc).filter(([, id]) => ITEMS.some(i => i.kind === 'acc' && i.id === id))),
  };
}

/** Buys one piece of "special meat" (= the arcade extra-life buff) with coins. */
export function buyMeat(db: DB, balance: number): { shop: Shop; arcade: NonNullable<DB['settings']['arcade']> } | null {
  if (balance < MEAT_PACK_PRICE) return null;
  const a = feedPet(db.settings.arcade, 1 /* the buff cap is checked here; the meat itself is paid in coins */);
  if (!a) return null;
  const s = norm(db.settings.shop);
  // feedPet also counted a piece of regular meat: undo that, coins pay instead
  return { shop: { ...s, spent: s.spent + MEAT_PACK_PRICE }, arcade: { ...a, meatSpent: a.meatSpent - 1 } };
}
