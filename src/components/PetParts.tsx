import { useMemo, useState } from 'react';
import { Check, Flame, Swords } from 'lucide-react';
import { faNum } from '../ui';
import { BOSS_XP, coachLines, PERFECT_DAY_XP, QUEST_XP, XP_PER_LEVEL } from '../services/game';
import type { Boss, GameState, Quest } from '../services/game';
import { MOOD_LABEL } from '../services/pet';
import { stageGlow, useGame } from './useGame';

/** Wolf inside an XP ring, with a level badge. Tap to hear the next coach line. */
export function PetHero({ big = false }: { big?: boolean }) {
  const { data, g } = useGame();
  const [i, setI] = useState(0);
  const lines = useMemo(() => coachLines(data, g), [data, g]);
  const glow = stageGlow(g.xp.level);
  const size = big ? 188 : 150;
  const r = size / 2 - 7, c = 2 * Math.PI * r;
  const frac = g.xp.levelXp / XP_PER_LEVEL;
  return (
    <div className="relative flex items-center gap-4 md:gap-6" style={{ ['--glow' as string]: glow }}>
      <button onClick={() => setI(n => n + 1)} aria-label={`نوازش ${data.settings.petName}`} className="relative shrink-0 outline-none" style={{ width: size, height: size }}>
        <svg className="absolute inset-0 -rotate-90" width={size} height={size} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--glow)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ filter: 'drop-shadow(0 0 6px var(--glow))', transition: 'stroke-dashoffset .8s' }} />
        </svg>
        <img src="./wolf-pet.png" alt={`پت گرگ ${data.settings.petName}`} draggable={false} className={`pet-img pet-${g.mood} absolute inset-3 object-contain select-none`} style={{ width: size - 24, height: size - 24 }} />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white" style={{ background: 'linear-gradient(90deg,#5b21b6,var(--glow))', boxShadow: '0 0 12px var(--glow)' }}>LV.{faNum(g.xp.level)}</span>
      </button>
      <div className="flex-1 min-w-0 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] tracking-widest" style={{ color: 'var(--glow)' }}>{g.stage.title}</span>
          <span className="chip" style={{ background: 'rgba(139,92,246,.2)', color: '#d8c8ff' }}>{MOOD_LABEL[g.mood]}</span>
          <span className="chip" style={{ background: g.streak.current ? 'rgba(249,115,22,.18)' : 'rgba(255,255,255,.07)', color: g.streak.current ? '#fdba74' : '#a8a0b8' }} title={`بهترین زنجیره: ${faNum(g.streak.best)} روز`}>
            <Flame size={12} className="inline -mt-0.5" /> {faNum(g.streak.current)} روز{g.streak.atRisk ? ' · در خطر!' : ''}
          </span>
        </div>
        <h3 className={`${big ? 'text-3xl' : 'text-xl md:text-2xl'} font-extrabold mt-1`}>{data.settings.petName}</h3>
        <p key={i} className="pet-say text-sm mt-2" role="status">{lines[i % lines.length]}</p>
        <div className="mt-3 max-w-sm">
          <div className="flex justify-between text-[11px] mb-1 text-violet-200/80"><span>تا سطح {faNum(g.xp.level + 1)}</span><bdi dir="ltr">{faNum(g.xp.levelXp)} / {faNum(XP_PER_LEVEL)} XP</bdi></div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden"><i className="block h-full rounded-full pet-xp" style={{ width: `${frac * 100}%` }} /></div>
        </div>
      </div>
    </div>
  );
}

export function QuestList({ g, go }: { g: GameState; go?: (p: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-white">
        <h4 className="text-sm font-bold">مأموریت‌های امروز <span className="text-violet-300 font-normal">({faNum(g.questsDone)}/{faNum(g.quests.length)})</span></h4>
        <span className={`chip ${g.perfectToday ? '' : 'opacity-70'}`} style={{ background: g.perfectToday ? 'rgba(250,204,21,.18)' : 'rgba(255,255,255,.07)', color: g.perfectToday ? '#fde68a' : '#c4b5fd' }}>{g.perfectToday ? '🌟 جایزه گرفتی' : `جایزهٔ همه: ${faNum(PERFECT_DAY_XP)} XP`}</span>
      </div>
      <ul className="grid gap-2">
        {g.quests.map(q => <QuestRow key={q.id} q={q} go={go} />)}
      </ul>
    </div>
  );
}

function QuestRow({ q, go }: { q: Quest; go?: (p: string) => void }) {
  const body = (
    <>
      <span className="text-xl w-7 text-center shrink-0">{q.done ? <Check className="text-emerald-400 mx-auto" size={20} /> : q.icon}</span>
      <span className="flex-1 min-w-0 text-start">
        <span className={`block text-[13px] ${q.done ? 'line-through opacity-60' : ''}`}>{q.title}</span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden"><i className="block h-full rounded-full pet-xp" style={{ width: `${(q.progress / q.goal) * 100}%` }} /></span>
          <span className="text-[10px] text-violet-200/70 whitespace-nowrap">{faNum(q.progress)}/{faNum(q.goal)} {q.unit}</span>
        </span>
      </span>
      <span className="chip shrink-0" style={{ background: q.done ? 'rgba(52,211,153,.18)' : 'rgba(139,92,246,.2)', color: q.done ? '#6ee7b7' : '#d8c8ff' }}><bdi dir="ltr">{faNum(QUEST_XP)} XP</bdi></span>
    </>
  );
  const cls = 'quest-row flex items-center gap-3 rounded-xl px-3 py-2.5 w-full text-white';
  return <li>{go && !q.done ? <button onClick={() => go(q.page)} className={cls + ' hover:brightness-125'}>{body}</button> : <div className={cls}>{body}</div>}</li>;
}

export function BossBar({ boss }: { boss: Boss }) {
  const pct = (boss.hp / boss.max) * 100;
  return (
    <div className="quest-row rounded-xl p-3 text-white h-full">
      <div className="flex items-center gap-3">
        <span className={`text-4xl ${boss.defeated ? 'grayscale opacity-60' : 'boss-float'}`}>{boss.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] text-rose-300"><Swords size={13} />باس هفته</div>
          <div className="font-bold text-sm truncate">{boss.name}</div>
        </div>
      </div>
      <div className="mt-3 h-3 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={boss.hp} aria-valuemax={boss.max} aria-label="جان باس">
        <i className="block h-full rounded-full boss-hp" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] mt-1.5 text-rose-100/80">
        <span>{boss.defeated ? 'شکست خورد! 🎉' : `${faNum(boss.hp)} از ${faNum(boss.max)} جان مانده`}</span>
        <span>{faNum(boss.dealt)} ضربه · {boss.daysLeft === 0 ? 'امروز آخرین روز' : `${faNum(boss.daysLeft)} روز مانده`}</span>
      </div>
      <p className="text-[11px] mt-2 text-violet-200/70">هر کار تمام‌شده = ۱ ضربه. شکستش {faNum(BOSS_XP)} XP می‌دهد.</p>
    </div>
  );
}
