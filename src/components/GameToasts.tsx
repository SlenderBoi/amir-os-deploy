import { useEffect, useRef, useState } from 'react';
import { faNum } from '../ui';
import { BOSS_XP, PERFECT_DAY_XP, QUEST_XP } from '../services/game';
import { localISO } from '../services/dates';
import { useGame } from './useGame';

const KEY = 'amir-os:game-seen';
interface Seen { level: number; badges: string[]; quests: Record<string, string[]>; boss: string }
interface Toast { id: number; icon: string; title: string; text: string }

const read = (): Seen | null => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v.level === 'number' ? v : null; } catch { return null; } };

/**
 * Celebrates real progress: level-ups, new badges, finished quests, perfect days and defeated bosses.
 * The first run only records the current state (no flood of toasts for old data).
 */
export default function GameToasts() {
  const { data, g } = useGame();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [burst, setBurst] = useState(0);
  const n = useRef(0);

  useEffect(() => {
    const today = localISO();
    const doneQuests = g.quests.filter(q => q.done).map(q => q.id);
    const doneBadges = g.badges.filter(b => b.done).map(b => b.id);
    const boss = g.boss.defeated ? g.boss.weekStart : '';
    const prev = read();
    // "seen" only ever grows (within a day / week), so un-ticking and re-ticking a task can't replay a celebration
    const next: Seen = {
      level: Math.max(g.xp.level, prev?.level ?? 0),
      badges: [...new Set([...(prev?.badges ?? []), ...doneBadges])],
      quests: { [today]: [...new Set([...(prev?.quests[today] ?? []), ...doneQuests])] },
      boss: boss || (prev?.boss ?? ''),
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    if (!prev || !data.settings.petEnabled) return;

    const out: Omit<Toast, 'id'>[] = [];
    let party = false;
    if (g.xp.level > prev.level) { out.push({ icon: '⬆️', title: 'لِول آپ!', text: `${data.settings.petName} حالا سطح ${faNum(g.xp.level)} است (${g.stage.title})` }); party = true; }
    const before = prev.quests[today] ?? [];
    for (const q of g.quests) if (q.done && !before.includes(q.id)) out.push({ icon: q.icon, title: 'مأموریت انجام شد', text: `${q.title} · ${faNum(QUEST_XP)} XP` });
    if (g.perfectToday && before.length < g.quests.length) { out.push({ icon: '🌟', title: 'روز بی‌نقص!', text: `همهٔ مأموریت‌ها · جایزه ${faNum(PERFECT_DAY_XP)} XP` }); party = true; }
    for (const b of g.badges) if (b.done && !prev.badges.includes(b.id)) { out.push({ icon: b.icon, title: `دستاورد جدید: ${b.title}`, text: b.desc }); party = true; }
    if (boss && prev.boss !== boss) { out.push({ icon: g.boss.icon, title: `${g.boss.name} شکست خورد!`, text: `جایزه ${faNum(BOSS_XP)} XP` }); party = true; }
    if (!out.length) return;
    const added = out.slice(0, 4).map(t => ({ ...t, id: ++n.current }));
    setToasts(t => [...t, ...added].slice(-4));
    if (party) setBurst(b => b + 1);
    added.forEach(t => setTimeout(() => setToasts(cur => cur.filter(x => x.id !== t.id)), 6500));
  }, [g, data.settings.petName, data.settings.petEnabled]);

  useEffect(() => { if (!burst) return; const t = setTimeout(() => setBurst(0), 2600); return () => clearTimeout(t); }, [burst]);

  return (
    <>
      {burst > 0 && (
        <div className="fixed inset-x-0 top-0 h-screen z-[70] pointer-events-none overflow-hidden" aria-hidden>
          {Array.from({ length: 36 }, (_, i) => <i key={`${burst}-${i}`} className="confetti" style={{ left: `${(i * 97) % 100}%`, background: ['#a855f7', '#22d3ee', '#fde047', '#fb7185', '#34d399'][i % 5], animationDelay: `${(i % 9) * 0.07}s`, ['--dx' as string]: `${((i * 53) % 120) - 60}px` }} />)}
        </div>
      )}
      <div className="fixed z-[75] top-20 left-3 right-3 md:right-auto md:w-80 space-y-2 pointer-events-none" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className="game-toast pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-white">
            <span className="text-2xl">{t.icon}</span>
            <div className="min-w-0"><div className="font-bold text-sm">{t.title}</div><div className="text-xs text-violet-200/80">{t.text}</div></div>
          </div>
        ))}
      </div>
    </>
  );
}
