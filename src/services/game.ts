import type { DB } from '../types';
import { localISO } from './dates';
import { coinBalance } from '../shop/rules';
import { computeXp, MOOD_LABEL, petMood, petSpeech, petStage, XP_PER_LEVEL } from './pet';
import type { PetMood } from './pet';

/**
 * The "game" around the wolf. Everything here is DERIVED from the user's real data (nothing extra is stored),
 * so progress can't be faked, survives backups/restores and never needs a schema change.
 */
export const QUEST_XP = 10;
export const PERFECT_DAY_XP = 40;
export const BOSS_TARGET = 12;
export const BOSS_XP = 100;

const MIN = 60_000;
const dayOf = (iso: string) => (iso.length === 10 ? iso : localISO(new Date(iso)));
export const addDays = (date: string, n: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  return localISO(new Date(y, m - 1, d + n, 12));
};
const dayNumber = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/* ------------------------------------------------------------------ facts per day */

export interface DayFacts { tasksDone: number; highDone: number; focusMin: number; habitsDone: number; journal: number; notes: number; early: number; late: number }
const blank = (): DayFacts => ({ tasksDone: 0, highDone: 0, focusMin: 0, habitsDone: 0, journal: 0, notes: 0, early: 0, late: 0 });

export function dayFactsMap(db: DB): Map<string, DayFacts> {
  const m = new Map<string, DayFacts>();
  const at = (d: string) => { let f = m.get(d); if (!f) { f = blank(); m.set(d, f); } return f; };
  for (const t of db.tasks) {
    if (t.status !== 'done' || !t.completedAt) continue;
    const when = new Date(t.completedAt);
    if (isNaN(+when)) continue;
    const f = at(localISO(when));
    f.tasksDone++;
    if (t.priority === 'high' || t.priority === 'urgent') f.highDone++;
    if (when.getHours() < 8) f.early++;
    if (when.getHours() >= 22) f.late++;
  }
  for (const t of db.learning) for (const l of t.logs) at(l.date).focusMin += l.minutes;
  for (const e of db.timeEntries) at(e.date).focusMin += e.minutes;
  for (const h of db.habits) if (h.target > 0) for (const [d, v] of Object.entries(h.entries)) if (v >= h.target) at(d).habitsDone++;
  for (const j of db.journal) {
    const filled = j.intentions.length > 0 || [j.wins, j.improve, j.gratitude, j.note].some(s => s.trim());
    if (filled) at(j.date).journal++;
  }
  for (const n of db.notes) at(dayOf(n.createdAt)).notes++;
  return m;
}

/* ------------------------------------------------------------------ daily quests */

export interface Quest { id: string; icon: string; title: string; goal: number; progress: number; done: boolean; unit: string; page: string }

export function questsFor(db: DB, f: DayFacts = blank()): Quest[] {
  const hasHabits = db.habits.length > 0;
  const q = (id: string, icon: string, title: string, goal: number, progress: number, unit: string, page: string): Quest =>
    ({ id, icon, title, goal, progress: Math.min(progress, goal), done: progress >= goal, unit, page });
  return [
    q('tasks', '⚔️', 'سه کار را تمام کن', 3, f.tasksDone, 'کار', 'tasks'),
    q('focus', '🎯', '۲۵ دقیقه تمرکز یا یادگیری', 25, f.focusMin, 'دقیقه', 'learning'),
    hasHabits ? q('habit', '🔥', 'یک عادت امروز را کامل کن', 1, f.habitsDone, 'عادت', 'health')
      : q('idea', '💡', 'یک ایده یا یادداشت ثبت کن', 1, f.notes, 'مورد', 'notes'),
    q('journal', '📖', 'ثبت روزانه: یک هدف یا جمع‌بندی بنویس', 1, f.journal, 'صفحه', 'journal'),
  ];
}

export const questDoneCount = (qs: Quest[]) => qs.filter(x => x.done).length;

/* ------------------------------------------------------------------ streak */

export interface Streak { current: number; best: number; atRisk: boolean; activeToday: boolean }

export function streakOf(active: Set<string>, today: string): Streak {
  const activeToday = active.has(today);
  let cur = 0;
  for (let d = activeToday ? today : addDays(today, -1); active.has(d); d = addDays(d, -1)) cur++;
  const days = [...active].sort();
  let best = 0, run = 0, prev = '';
  for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return { current: cur, best: Math.max(best, cur), atRisk: !activeToday && cur > 0, activeToday };
}

/* ------------------------------------------------------------------ weekly boss */

export const BOSSES: { name: string; icon: string }[] = [
  { name: 'اژدهای تعلل', icon: '🐉' }, { name: 'غول بی‌نظمی', icon: '👹' }, { name: 'شبحِ کارِ نیمه‌تمام', icon: '👻' },
  { name: 'جادوگر تعویق', icon: '🧙' }, { name: 'هیولای حواس‌پرتی', icon: '🦑' }, { name: 'گولم صندوق ورودی', icon: '🗿' },
];

export function weekStartOf(date: string, saturday: boolean): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(y, m - 1, d, 12).getDay(); // 0 = Sunday
  const back = saturday ? (dow + 1) % 7 : (dow + 6) % 7;
  return addDays(date, -back);
}

export interface Boss { name: string; icon: string; weekStart: string; hp: number; max: number; dealt: number; defeated: boolean; daysLeft: number }

export function bossFor(db: DB, today: string): Boss {
  const sat = !!db.settings.weekStartsSaturday;
  const start = weekStartOf(today, sat);
  const end = addDays(start, 6);
  const dealt = weeklyDone(db).get(start) ?? 0;
  const b = BOSSES[((Math.floor(dayNumber(start) / 7) % BOSSES.length) + BOSSES.length) % BOSSES.length];
  return { ...b, weekStart: start, max: BOSS_TARGET, dealt, hp: Math.max(0, BOSS_TARGET - dealt), defeated: dealt >= BOSS_TARGET, daysLeft: dayNumber(end) - dayNumber(today) };
}

function weeklyDone(db: DB): Map<string, number> {
  const sat = !!db.settings.weekStartsSaturday;
  const m = new Map<string, number>();
  for (const [d, f] of dayFactsMap(db)) if (f.tasksDone) { const w = weekStartOf(d, sat); m.set(w, (m.get(w) ?? 0) + f.tasksDone); }
  return m;
}

/* ------------------------------------------------------------------ badges */

export interface Badge { id: string; icon: string; title: string; desc: string; progress: number; goal: number; done: boolean }

export interface GameState {
  coins: number;
  xp: { total: number; level: number; levelXp: number; parts: { label: string; xp: number }[] };
  quests: Quest[];
  questsDone: number;
  perfectToday: boolean;
  perfectDays: number;
  streak: Streak;
  boss: Boss;
  bossesDefeated: number;
  badges: Badge[];
  mood: PetMood;
  stage: ReturnType<typeof petStage>;
}

export function gameState(db: DB, now: Date = new Date()): GameState {
  const today = localISO(now);
  const facts = dayFactsMap(db);
  const base = computeXp(db);

  let questXp = 0, perfectDays = 0, tasksDone = 0, focusMin = 0, early = 0, late = 0, journalDays = 0;
  const active = new Set<string>();
  for (const [d, f] of facts) {
    const qs = questsFor(db, f);
    const n = questDoneCount(qs);
    if (n > 0) active.add(d);
    questXp += n * QUEST_XP;
    if (n === qs.length) { questXp += PERFECT_DAY_XP; perfectDays++; }
    tasksDone += f.tasksDone; focusMin += f.focusMin; early += f.early; late += f.late; journalDays += f.journal ? 1 : 0;
  }
  const weeks = weeklyDone(db);
  const bossesDefeated = [...weeks.values()].filter(n => n >= BOSS_TARGET).length;
  const parts = [...base.parts, { label: 'مأموریت‌های روزانه', xp: questXp }, { label: 'شکست باس هفتگی', xp: bossesDefeated * BOSS_XP }];
  const total = parts.reduce((a, p) => a + p.xp, 0);
  const level = Math.floor(total / XP_PER_LEVEL) + 1;

  const quests = questsFor(db, facts.get(today));
  const streak = streakOf(active, today);
  const arcade = db.settings.arcade?.best ?? {};
  const wishesDone = db.wishes.filter(w => w.status === 'done').length;
  const bd = (id: string, icon: string, title: string, desc: string, progress: number, goal: number): Badge =>
    ({ id, icon, title, desc, progress: Math.min(progress, goal), goal, done: progress >= goal });
  const badges: Badge[] = [
    bd('first', '🩸', 'اولین شکار', 'اولین کارت را تمام کن', tasksDone, 1),
    bd('hunter10', '🏹', 'شکارچی', '۱۰ کار تمام‌شده', tasksDone, 10),
    bd('hunter50', '🗡️', 'جنگجو', '۵۰ کار تمام‌شده', tasksDone, 50),
    bd('hunter100', '👑', 'فرمانده', '۱۰۰ کار تمام‌شده', tasksDone, 100),
    bd('streak3', '🔥', 'شعله', '۳ روز پشت‌سرهم فعال', streak.best, 3),
    bd('streak7', '🌋', 'آتشفشان', '۷ روز پشت‌سرهم فعال', streak.best, 7),
    bd('streak30', '☄️', 'ستارهٔ دنباله‌دار', '۳۰ روز پشت‌سرهم فعال', streak.best, 30),
    bd('perfect1', '🌟', 'روز بی‌نقص', 'همهٔ مأموریت‌های یک روز', perfectDays, 1),
    bd('perfect7', '💎', 'هفت روز بی‌نقص', '۷ روز با همهٔ مأموریت‌ها', perfectDays, 7),
    bd('boss1', '🐲', 'باس‌کش', 'یک باس هفتگی را شکست بده', bossesDefeated, 1),
    bd('boss5', '🏆', 'افسانهٔ باس', '۵ باس هفتگی', bossesDefeated, 5),
    bd('scholar10', '📚', 'دانشجو', '۱۰ ساعت تمرکز و یادگیری', Math.floor(focusMin / 60), 10),
    bd('scholar50', '🧠', 'استاد', '۵۰ ساعت تمرکز و یادگیری', Math.floor(focusMin / 60), 50),
    bd('early', '🌅', 'سحرخیز', '۵ کار پیش از ساعت ۸ صبح', early, 5),
    bd('late', '🦉', 'جغد شب', '۵ کار بعد از ساعت ۲۲', late, 5),
    bd('journal7', '📓', 'راوی', '۷ روز ثبت روزانه', journalDays, 7),
    bd('ideas10', '💡', 'ایده‌پرداز', '۱۰ ایده یا یادداشت', db.notes.length, 10),
    bd('wish3', '🎁', 'آرزوی برآورده', '۳ مورد ویش‌لیست تمام‌شده', wishesDone, 3),
    bd('arc-doodle', '🪂', 'پرندهٔ ماه', '۱۰۰ امتیاز در بازی «پرش تا ماه»', arcade.doodle ?? 0, 100),
    bd('arc-hunt', '🐇', 'گرگ شبگرد', '۱۵۰ امتیاز در بازی «شکار شبانه»', arcade.hunt ?? 0, 150),
    bd('arc-jinn', '👻', 'جن‌گیر', '۲۰۰ امتیاز در بازی «شکار جن»', arcade.jinn ?? 0, 200),
    bd('lvl5', '⭐', 'سطح ۵', 'به سطح ۵ برس', level, 5),
    bd('lvl10', '🌙', 'سطح ۱۰', 'به سطح ۱۰ برس', level, 10),
  ];

  return {
    coins: coinBalance(db, total),
    xp: { total, level, levelXp: total % XP_PER_LEVEL, parts },
    quests, questsDone: questDoneCount(quests), perfectToday: questDoneCount(quests) === quests.length, perfectDays,
    streak, boss: bossFor(db, today), bossesDefeated, badges, mood: petMood(db, now), stage: petStage(level),
  };
}

/* ------------------------------------------------------------------ coach lines */

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

/** Context-aware lines; the wolf says the first one, poking cycles through the rest. */
export function coachLines(db: DB, g: GameState, now: Date = new Date()): string[] {
  const out: string[] = [];
  const today = localISO(now);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const name = db.settings.petName || 'نُکس';
  const next = g.quests.find(q => !q.done);

  if (g.perfectToday) out.push(`همهٔ مأموریت‌های امروز تموم شد و جایزهٔ ${fa(PERFECT_DAY_XP)} XP را گرفتی! 🌟`);
  if (g.streak.atRisk && now.getHours() >= 17) out.push(`زنجیرهٔ ${fa(g.streak.current)} روزه‌ات امشب می‌پره! فقط یک مأموریت کوچیک 🔥`);
  const nextTimed = db.tasks
    .filter(t => t.due === today && t.time && t.time >= hhmm && t.status !== 'done' && t.status !== 'archived')
    .sort((a, b) => (a.time! < b.time! ? -1 : 1))[0];
  if (nextTimed) out.push(`ساعت ${nextTimed.time} «${nextTimed.title}» داریم. آماده‌ای؟`);
  if (!g.boss.defeated && g.boss.dealt > 0 && g.boss.hp <= 3) out.push(`${g.boss.name} فقط ${fa(g.boss.hp)} ضربه تا شکست مونده! ⚔️`);
  else if (g.boss.defeated) out.push(`${g.boss.name} شکست خورد! جایزهٔ ${fa(BOSS_XP)} XP برای تو 🐲`);
  else out.push(`باس این هفته «${g.boss.name}» است؛ ${fa(g.boss.hp)} ضربهٔ دیگر مانده.`);
  const overdue = db.tasks.filter(t => t.due && t.due < today && t.status !== 'done' && t.status !== 'archived').length;
  if (overdue > 0) out.push(`${fa(overdue)} کار عقب‌افتاده منتظرته؛ یکی‌اش رو بزن کنار.`);
  if (next) out.push(`مأموریت بعدی: «${next.title}» (${fa(next.progress)}/${fa(next.goal)} ${next.unit})`);
  out.push(petSpeech(g.mood, now.getDate() + now.getHours()));
  out.push(`${name} می‌گه: ${MOOD_LABEL[g.mood]}! بزن بریم.`);
  return [...new Set(out)];
}

export { XP_PER_LEVEL };
