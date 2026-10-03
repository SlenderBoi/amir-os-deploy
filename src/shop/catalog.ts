/** Everything the wolf shop sells. Prices are in coins (5 XP of real work = 1 coin). */
export type Slot = 'head' | 'face' | 'neck';
export type ItemKind = 'skin' | 'acc' | 'room';
export interface Item { id: string; kind: ItemKind; slot?: Slot; name: string; icon: string; desc: string; price: number; level: number }

export const FREE = { skin: 'neon', room: 'forest' } as const;

export const ITEMS: Item[] = [
  { id: 'neon', kind: 'skin', name: 'نئون بنفش', icon: '🟣', desc: 'گرگ اصلی شب‌ها', price: 0, level: 1 },
  { id: 'fire', kind: 'skin', name: 'گرگ آتشین', icon: '🔥', desc: 'خز سرخ و گرم', price: 40, level: 1 },
  { id: 'ice', kind: 'skin', name: 'گرگ یخی', icon: '❄️', desc: 'آبی یخ‌زده', price: 40, level: 1 },
  { id: 'forest', kind: 'skin', name: 'گرگ جنگلی', icon: '🌲', desc: 'سبز مثل جنگل شب', price: 60, level: 2 },
  { id: 'pink', kind: 'skin', name: 'گرگ صورتی', icon: '🌸', desc: 'صورتی نئونی', price: 60, level: 2 },
  { id: 'shadow', kind: 'skin', name: 'گرگ سایه', icon: '🌑', desc: 'خاکستری تاریک و مرموز', price: 100, level: 4 },
  { id: 'gold', kind: 'skin', name: 'گرگ طلایی', icon: '👑', desc: 'اسکین افسانه‌ای', price: 160, level: 6 },

  { id: 'sunglasses', kind: 'acc', slot: 'face', name: 'عینک آفتابی', icon: '🕶️', desc: 'خفن‌ترین نگاه', price: 30, level: 1 },
  { id: 'monocle', kind: 'acc', slot: 'face', name: 'تک‌عینک', icon: '🧐', desc: 'برای گرگ‌های اشراف‌زاده', price: 45, level: 2 },
  { id: 'partyhat', kind: 'acc', slot: 'head', name: 'کلاه جشن', icon: '🎉', desc: 'هر روز یه جشنه', price: 35, level: 1 },
  { id: 'halo', kind: 'acc', slot: 'head', name: 'هاله', icon: '😇', desc: 'گرگ فرشته', price: 80, level: 3 },
  { id: 'crown', kind: 'acc', slot: 'head', name: 'تاج', icon: '👑', desc: 'پادشاه شب', price: 120, level: 5 },
  { id: 'scarf', kind: 'acc', slot: 'neck', name: 'شال قرمز', icon: '🧣', desc: 'زمستون گرم', price: 30, level: 1 },
  { id: 'bell', kind: 'acc', slot: 'neck', name: 'قلاده و زنگوله', icon: '🔔', desc: 'صدای قدم‌های گرگ', price: 25, level: 1 },
  { id: 'bowtie', kind: 'acc', slot: 'neck', name: 'پاپیون', icon: '🎀', desc: 'رسمی و شیک', price: 40, level: 2 },

  { id: 'forest', kind: 'room', name: 'جنگل نئون', icon: '🌲', desc: 'اتاق اصلی', price: 0, level: 1 },
  { id: 'city', kind: 'room', name: 'شهر شبانه', icon: '🌃', desc: 'آسمان‌خراش و پنجره‌های روشن', price: 70, level: 2 },
  { id: 'desert', kind: 'room', name: 'کویر', icon: '🏜️', desc: 'تپه‌های شنی و کاکتوس', price: 70, level: 2 },
  { id: 'space', kind: 'room', name: 'فضا', icon: '🪐', desc: 'سیاره و ستاره‌ها', price: 90, level: 3 },
];

export const MEAT_PACK_PRICE = 12;
export const itemOf = (kind: ItemKind, id: string) => ITEMS.find(i => i.kind === kind && i.id === id);
export const itemsOf = (kind: ItemKind) => ITEMS.filter(i => i.kind === kind);
