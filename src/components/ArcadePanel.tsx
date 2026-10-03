import { useState } from 'react';
import { Lock } from 'lucide-react';
import { faNum } from '../ui';
import { GAMES } from '../arcade/games';
import { isUnlocked } from '../arcade/rules';
import type { GameDef } from '../arcade/types';
import { useGame } from './useGame';
import ArcadeModal from './ArcadeModal';

/** The three pixel games. Each one unlocks at a pet level, so real work opens new games. */
export default function ArcadePanel() {
  const { data, g } = useGame();
  const [open, setOpen] = useState<GameDef | null>(null);
  const a = data.settings.arcade;
  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-white">
        <h4 className="text-sm font-bold">🕹️ سالن بازی</h4>
        {(a?.buffs ?? 0) > 0 && <span className="chip" style={{ background: 'rgba(52,211,153,.18)', color: '#6ee7b7' }}>🍖 جان اضافه برای بازی بعد: {faNum(a!.buffs)}</span>}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {GAMES.map(d => {
          const on = isUnlocked(d.id, g.xp.level);
          const best = a?.best[d.id] ?? 0;
          return (
            <button key={d.id} disabled={!on} onClick={() => setOpen(d)} aria-label={on ? `بازی ${d.title}` : `${d.title} قفل است`} className={`quest-row rounded-xl p-3 text-start text-white transition ${on ? 'hover:brightness-125' : 'opacity-60 cursor-not-allowed'}`}>
              <div className="flex items-center gap-2"><span className="text-2xl">{on ? d.icon : <Lock size={22} />}</span><b className="text-sm">{d.title}</b></div>
              <p className="text-[11px] text-violet-200/70 mt-1.5 leading-5 min-h-[3.2em]">{on ? d.blurb : `با رسیدن به سطح ${faNum(d.unlock)} باز می‌شود (سطح تو: ${faNum(g.xp.level)})`}</p>
              {on && <div className="text-[11px] mt-1 text-amber-200">{best ? `رکورد: ${faNum(best)}` : 'هنوز بازی نکرده‌ای'}</div>}
            </button>
          );
        })}
      </div>
      {open && <ArcadeModal def={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
