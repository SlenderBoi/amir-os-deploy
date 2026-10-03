import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, PawPrint, Sparkles } from 'lucide-react';
import { useStore } from '../store';
import { Card, faNum } from '../ui';
import { computeXp, MOOD_LABEL, petMood, petSpeech, petStage, XP_PER_LEVEL } from '../services/pet';

const LEVEL_KEY = 'amir-os:pet-level';

/** Reads/writes the last level the user has *seen*, so a level-up banner shows exactly once. */
function useLevelUp(level: number) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const seen = Number(localStorage.getItem(LEVEL_KEY) ?? 0);
    if (seen && level > seen) setUp(true);
    localStorage.setItem(LEVEL_KEY, String(level));
  }, [level]);
  return [up, () => setUp(false)] as const;
}

export default function PetCard() {
  const { data } = useStore();
  const stats = useMemo(() => computeXp(data), [data]);
  const mood = useMemo(() => petMood(data), [data]);
  const stage = petStage(stats.level);
  const [tick, setTick] = useState(() => Math.floor(Math.random() * 100));
  const [open, setOpen] = useState(false);
  const [levelUp, dismiss] = useLevelUp(stats.level);

  const poke = () => setTick(t => t + 1);

  return (
    <Card className="relative overflow-hidden !p-0 pet-stage">
      <div className="absolute inset-0 pet-aura" aria-hidden />
      {Array.from({ length: 7 }, (_, i) => <i key={i} className="pet-spark" style={{ left: `${8 + i * 13}%`, animationDelay: `${i * 0.9}s` }} aria-hidden />)}
      <div className="relative flex items-center gap-3 md:gap-6 p-4 md:p-6">
        <button onClick={poke} aria-label={`نوازش ${data.settings.petName}`} className="relative shrink-0 outline-none">
          <img src="./wolf-pet.png" alt={`پت گرگ ${data.settings.petName}`} draggable={false}
            className={`pet-img pet-${mood} w-32 h-32 md:w-44 md:h-44 object-contain select-none`} />
        </button>
        <div className="flex-1 min-w-0 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <PawPrint size={16} className="text-violet-400" />
            <span className="text-[11px] tracking-widest text-violet-300">{stage.title}</span>
            <span className="chip" style={{ background: 'rgba(139,92,246,.2)', color: '#d8c8ff' }}>{MOOD_LABEL[mood]}</span>
          </div>
          <h3 className="text-xl md:text-2xl font-extrabold mt-1">{data.settings.petName} <span className="text-sm text-violet-300">LV.{faNum(stats.level)}</span></h3>
          <p key={tick} className="pet-say text-sm mt-3" role="status">{petSpeech(mood, tick)}</p>
          <div className="mt-3 max-w-sm">
            <div className="flex justify-between text-[11px] mb-1 text-violet-200/80"><span>تا سطح بعد</span><span>{faNum(stats.levelXp)} / {faNum(XP_PER_LEVEL)} XP</span></div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden"><i className="block h-full rounded-full pet-xp" style={{ width: `${(stats.levelXp / XP_PER_LEVEL) * 100}%` }} /></div>
          </div>
          {levelUp && (
            <button onClick={dismiss} className="mt-3 flex items-center gap-2 text-xs rounded-xl px-3 py-2 pet-levelup"><Sparkles size={14} />لِول آپ! {data.settings.petName} حالا سطح {faNum(stats.level)} است. (بستن)</button>
          )}
          <button onClick={() => setOpen(o => !o)} className="mt-3 flex items-center gap-1 text-[11px] text-violet-300/80" aria-expanded={open}>
            XP از کجا آمده؟ <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
          </button>
        </div>
      </div>
      {open && (
        <div className="relative border-t border-white/10 px-4 md:px-6 py-3 grid sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-violet-100/80">
          {stats.parts.map(p => <div key={p.label} className="flex justify-between"><span>{p.label}</span><b>{faNum(p.xp)} XP</b></div>)}
          <div className="sm:col-span-2 mt-1 text-violet-300/70">{stage.next ? `تکامل بعدی «${stage.next.title}» در سطح ${faNum(stage.next.minLevel)}` : 'به آخرین مرحلهٔ تکامل رسیده‌ای.'}</div>
        </div>
      )}
    </Card>
  );
}

/** Compact avatar for the sidebar. */
export function PetMini() {
  const { data } = useStore();
  const stats = useMemo(() => computeXp(data), [data]);
  if (!data.settings.petEnabled) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl p-2.5 pet-stage">
      <span className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-black/40 border border-violet-500/30">
        <img src="./wolf-pet.png" alt="" className="w-full h-full object-cover" style={{ objectPosition: '25% 8%', transform: 'scale(1.9)', transformOrigin: '30% 14%' }} />
      </span>
      <div className="min-w-0 flex-1 text-white">
        <div className="text-xs font-bold truncate">{data.settings.petName} <span className="text-violet-300">LV.{faNum(stats.level)}</span></div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1.5"><i className="block h-full rounded-full pet-xp" style={{ width: `${(stats.levelXp / XP_PER_LEVEL) * 100}%` }} /></div>
      </div>
    </div>
  );
}
