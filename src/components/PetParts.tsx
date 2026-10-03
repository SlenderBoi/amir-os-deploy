import { useMemo, useState } from 'react';
import { Check, Flame, Swords } from 'lucide-react';
import { faNum } from '../ui';
import { BOSS_XP, coachLines, PERFECT_DAY_XP, QUEST_XP, XP_PER_LEVEL } from '../services/game';
import type { Boss, GameState, Quest } from '../services/game';
import { MOOD_LABEL } from '../services/pet';
import { stageGlow, useGame } from './useGame';
import { useStore } from '../store';
import { feedPet, MAX_BUFFS, meatLeft } from '../arcade/rules';
import { lookOf } from '../shop/rules';
import type { Look } from '../shop/rules';
import PixelPet from './PixelPet';

/** The pixel wolf's room + status. Tap the wolf to pet it, tap the ground to make it walk, feed it with meat earned from finished tasks. */
export function PetHero({ big = false, go, look }: { big?: boolean; go?: (p: any) => void; look?: Look }) {
  const { data, setData } = useStore();
  const { g } = useGame();
  const [i, setI] = useState(0);
  const [say, setSay] = useState<string | null>(null);
  const [feedTick, setFeedTick] = useState(0);
  const lines = useMemo(() => coachLines(data, g), [data, g]);
  const glow = stageGlow(g.xp.level);
  const frac = g.xp.levelXp / XP_PER_LEVEL;
  const meat = meatLeft(data);
  const buffs = data.settings.arcade?.buffs ?? 0;
  const feed = () => {
    const next = feedPet(data.settings.arcade, meat);
    if (!next) { setSay(buffs >= MAX_BUFFS ? 'سیرم! سه جان اضافه برای بازی ذخیره دارم 🍖' : 'گوشت ندارم! با تمام‌کردن کارها گوشت جمع می‌شود 🥩'); return; }
    setData(d => ({ ...d, settings: { ...d.settings, arcade: feedPet(d.settings.arcade, meatLeft(d)) ?? d.settings.arcade } }));
    setFeedTick(n => n + 1); setSay('ممنون! دور بعدی بازی‌ها یک جان اضافه داری 🍖');
  };
  return (
    <div className={`relative flex flex-col ${big ? 'lg:flex-row' : 'md:flex-row'} gap-4 md:gap-6 items-stretch ${big ? 'lg:items-center' : 'md:items-center'}`} style={{ ['--glow' as string]: glow }}>
      <div className={`relative shrink-0 rounded-xl overflow-hidden ${big ? 'lg:w-[460px]' : 'md:w-[340px]'}`} style={{ border: `2px solid ${glow}`, boxShadow: `0 0 22px ${glow}66` }}>
        <PixelPet look={look ?? lookOf(data.settings.shop)} glow={glow} feedTick={feedTick} label={`نوازش ${data.settings.petName}`} onPoke={() => { setI(n => n + 1); setSay(null); }} />
        <span className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white" style={{ background: 'linear-gradient(90deg,#5b21b6,var(--glow))', boxShadow: '0 0 12px var(--glow)' }}>LV.{faNum(g.xp.level)}</span>
      </div>
      <div className="flex-1 min-w-0 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] tracking-widest" style={{ color: 'var(--glow)' }}>{g.stage.title}</span>
          <span className="chip" style={{ background: 'rgba(139,92,246,.2)', color: '#d8c8ff' }}>{MOOD_LABEL[g.mood]}</span>
          <span className="chip" style={{ background: g.streak.current ? 'rgba(249,115,22,.18)' : 'rgba(255,255,255,.07)', color: g.streak.current ? '#fdba74' : '#a8a0b8' }} title={`بهترین زنجیره: ${faNum(g.streak.best)} روز`}>
            <Flame size={12} className="inline -mt-0.5" /> {faNum(g.streak.current)} روز{g.streak.atRisk ? ' · در خطر!' : ''}
          </span>
        </div>
        <h3 className={`${big ? 'text-3xl' : 'text-xl md:text-2xl'} font-extrabold mt-1`}>{data.settings.petName}</h3>
        <p key={`${i}-${say}`} className="pet-say text-sm mt-2" role="status">{say ?? lines[i % lines.length]}</p>
        <div className="mt-3 max-w-sm">
          <div className="flex justify-between text-[11px] mb-1 text-violet-200/80"><span>تا سطح {faNum(g.xp.level + 1)}</span><bdi dir="ltr">{faNum(g.xp.levelXp)} / {faNum(XP_PER_LEVEL)} XP</bdi></div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden"><i className="block h-full rounded-full pet-xp" style={{ width: `${frac * 100}%` }} /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={feed} className="quest-row rounded-xl px-3 py-2 text-xs font-bold hover:brightness-125" aria-label="غذا دادن به گرگ">🍖 غذا بده · {faNum(meat)} گوشت</button>
          {go && <button onClick={() => go('shop')} className="quest-row rounded-xl px-3 py-2 text-xs font-bold hover:brightness-125" aria-label="فروشگاه گرگ">🛍️ فروشگاه · <span style={{ color: '#fde047' }}>{faNum(g.coins)} 🪙</span></button>}
          <span className="text-[11px] text-violet-200/70">گوشت = کار تمام‌شده · هر غذا یک جان اضافه در بازی‌ها{buffs ? ` (ذخیره: ${faNum(buffs)})` : ''}</span>
        </div>
        <p className="text-[11px] text-violet-200/50 mt-2">روی گرگ بزن تا نوازش شود؛ روی زمین بزن تا بیاید. شب‌ها (۲۳ تا ۶) می‌خوابد 😴</p>
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
