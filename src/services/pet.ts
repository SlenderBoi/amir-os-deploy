import type { DB } from './../types';
import { localISO } from './dates';

/** The pet's growth is *derived* from real activity (never stored), so it can't be cheated and survives backups. */
export const XP_PER_LEVEL = 250;

export interface XpPart { label: string; xp: number }
export interface PetStats { total: number; level: number; levelXp: number; parts: XpPart[] }

export function computeXp(db: DB): PetStats {
  const logs = db.learning.flatMap(t => t.logs);
  const habitDays = db.habits.reduce((n, h) => n + Object.values(h.entries).filter(v => v >= h.target).length, 0);
  const parts: XpPart[] = [
    { label: 'کار انجام‌شده', xp: db.tasks.filter(t => t.status === 'done').length * 25 },
    { label: 'زمان یادگیری', xp: Math.floor(logs.reduce((a, l) => a + l.minutes, 0) / 5) },
    { label: 'نکته و ایدهٔ یادگیری', xp: logs.reduce((a, l) => a + l.keyPoints.length + l.ideas.length, 0) * 3 },
    { label: 'مرور فاصله‌دار', xp: logs.reduce((n, l) => n + (db.reviews[l.id]?.reps ?? 0), 0) * 3 },
    { label: 'ویش‌لیست تمام‌شده', xp: db.wishes.filter(w => w.status === 'done').length * 15 },
    { label: 'ایده و یادداشت', xp: db.notes.length * 4 },
    { label: 'عادت کامل‌شده', xp: habitDays * 5 },
  ];
  const total = parts.reduce((a, p) => a + p.xp, 0);
  return { total, level: Math.floor(total / XP_PER_LEVEL) + 1, levelXp: total % XP_PER_LEVEL, parts };
}

const STAGES: { minLevel: number; title: string }[] = [
  { minLevel: 1, title: 'توله‌گرگ' },
  { minLevel: 3, title: 'شکارچی شب' },
  { minLevel: 6, title: 'گرگ سایه' },
  { minLevel: 10, title: 'آلفای نئون' },
  { minLevel: 15, title: 'اسطورهٔ ماه' },
];

export function petStage(level: number) {
  const current = [...STAGES].reverse().find(s => level >= s.minLevel) ?? STAGES[0];
  const next = STAGES.find(s => s.minLevel > level);
  return { title: current.title, next };
}

export type PetMood = 'sleepy' | 'ready' | 'happy' | 'hyped' | 'proud' | 'hungry';

export const MOOD_LABEL: Record<PetMood, string> = {
  sleepy: 'خواب‌آلود', ready: 'آماده', happy: 'خوشحال', hyped: 'پرانرژی', proud: 'مغرور از تو', hungry: 'گرسنهٔ شکار',
};

export function petMood(db: DB, now: Date = new Date()): PetMood {
  const date = localISO(now);
  const hour = now.getHours();
  const dueToday = db.tasks.filter(t => t.due === date && t.status !== 'archived');
  const doneToday = db.tasks.filter(t => t.completedAt && localISO(new Date(t.completedAt)) === date).length;
  const learnedToday = db.learning.flatMap(t => t.logs).filter(l => l.date === date).reduce((a, l) => a + l.minutes, 0);
  if (dueToday.length > 0 && dueToday.every(t => t.status === 'done')) return 'proud';
  if (doneToday >= 3 || learnedToday >= 60) return 'hyped';
  if (doneToday + learnedToday > 0) return 'happy';
  if (hour < 6) return 'sleepy';
  return hour >= 16 ? 'hungry' : 'ready';
}

const SPEECH: Record<PetMood, string[]> = {
  sleepy: ['زززز… هنوز شبه. تو هم بخواب.', 'ماه هنوز بالاست؛ فردا شکار می‌کنیم.'],
  ready: ['صبح بخیر! اولین شکار امروز کدومه؟', 'یه کار کوچیک شروع کن؛ بقیه‌اش خودش میاد.', 'من آماده‌م. تو چی؟'],
  happy: ['عالی بود! همین‌جوری ادامه بده.', 'بوی پیشرفت میاد 🐾', 'یه قدم دیگه و امروز مال توئه.'],
  hyped: ['اووووو! امروز آتیش زدی!', 'این سرعت رو دوست دارم، آلفا!', 'XP داره می‌باره!'],
  proud: ['همهٔ کارهای امروز تموم شد. افتخار می‌کنم.', 'امروز رو بردی. حالا استراحت حقته.'],
  hungry: ['امروز هنوز هیچ شکاری نداشتیم… یه کار کوچیک؟', 'شکمم خالیه؛ با یه جلسهٔ یادگیری سیرم می‌کنی؟'],
};

export function petSpeech(mood: PetMood, tick: number): string {
  const lines = SPEECH[mood];
  return lines[Math.abs(tick) % lines.length];
}
