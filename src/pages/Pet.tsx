import { Flame, Trophy } from 'lucide-react';
import { Card, faNum } from '../ui';
import { useStore } from '../store';
import ArcadePanel from '../components/ArcadePanel';
import { BossBar, PetHero, QuestList } from '../components/PetParts';
import { stageGlow, useGame } from '../components/useGame';
import { BOSS_XP, PERFECT_DAY_XP, QUEST_XP, XP_PER_LEVEL } from '../services/game';

const STAGES: [number, string][] = [[1, 'توله‌گرگ'], [3, 'شکارچی شب'], [6, 'گرگ سایه'], [10, 'آلفای نئون'], [15, 'اسطورهٔ ماه']];

export default function PetPage({ go }: { go: (p: any) => void }) {
  const { setData } = useStore();
  const { data, g } = useGame();
  const s = data.settings;
  const patch = (p: Partial<typeof s>) => setData(d => ({ ...d, settings: { ...d.settings, ...p } }));
  const unlocked = g.badges.filter(b => b.done).length;
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <Card className="relative overflow-hidden !p-0 pet-stage">
        <div className="absolute inset-0 pet-aura" aria-hidden style={{ ['--glow' as string]: stageGlow(g.xp.level) }} />
        <div className="relative p-5 md:p-8"><PetHero big /></div>
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border-t border-white/10 text-white text-center">
          {[
            ['زنجیرهٔ فعلی', `${faNum(g.streak.current)} روز`, '🔥'], ['بهترین زنجیره', `${faNum(g.streak.best)} روز`, '🏅'],
            ['روزهای بی‌نقص', faNum(g.perfectDays), '🌟'], ['باس‌های شکست‌خورده', faNum(g.bossesDefeated), '🐲'],
          ].map(([l, v, i]) => <div key={l} className="bg-[#0d0716] py-3"><div className="text-lg font-extrabold">{i} {v}</div><div className="text-[11px] text-violet-200/70">{l}</div></div>)}
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card className="pet-stage"><QuestList g={g} go={go} /></Card>
        <Card className="pet-stage"><BossBar boss={g.boss} /></Card>
      </div>

      <Card className="pet-stage"><ArcadePanel /></Card>

      <Card>
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold flex items-center gap-2"><Trophy size={18} className="accent" />دستاوردها</h3><span className="text-xs muted">{faNum(unlocked)} از {faNum(g.badges.length)}</span></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {g.badges.map(b => (
            <div key={b.id} className={`badge-card rounded-2xl p-3 text-center ${b.done ? 'done' : ''}`}>
              <div className="badge-ic text-3xl">{b.icon}</div>
              <div className="text-sm font-bold mt-1">{b.title}</div>
              <div className="text-[11px] muted min-h-[2.2em]">{b.desc}</div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2"><i className="block h-full rounded-full pet-xp" style={{ width: `${(b.progress / b.goal) * 100}%` }} /></div>
              <div className="text-[10px] muted mt-1">{b.done ? 'باز شد ✓' : `${faNum(b.progress)} / ${faNum(b.goal)}`}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-bold mb-3">XP از کجا می‌آید؟</h3>
          <div className="space-y-1.5 text-sm">
            {g.xp.parts.map(p => <div key={p.label} className="flex justify-between"><span className="muted">{p.label}</span><b>{faNum(p.xp)} XP</b></div>)}
            <div className="flex justify-between pt-2 mt-1 border-t" style={{ borderColor: 'var(--border)' }}><span>جمع</span><b>{faNum(g.xp.total)} XP</b></div>
          </div>
          <p className="text-[11px] muted mt-3 leading-6">هر مأموریت {faNum(QUEST_XP)} XP، تمام‌کردن همهٔ مأموریت‌های یک روز {faNum(PERFECT_DAY_XP)} XP اضافه و شکست باس هفته {faNum(BOSS_XP)} XP. هر {faNum(XP_PER_LEVEL)} XP یک سطح. همه‌چیز از فعالیت واقعی تو حساب می‌شود، پس تقلبی در کار نیست.</p>
        </Card>
        <Card>
          <h3 className="font-bold mb-3 flex items-center gap-2"><Flame size={18} className="accent" />مراحل تکامل</h3>
          <ol className="space-y-2">
            {STAGES.map(([lv, name]) => {
              const on = g.xp.level >= lv;
              return <li key={lv} className="flex items-center gap-3 text-sm"><span className="w-3 h-3 rounded-full" style={{ background: on ? stageGlow(lv) : 'transparent', border: `2px solid ${stageGlow(lv)}`, boxShadow: on ? `0 0 10px ${stageGlow(lv)}` : 'none' }} /><span className={on ? '' : 'muted'}>{name}</span><span className="text-[11px] muted ms-auto">از سطح {faNum(lv)}</span></li>;
            })}
          </ol>
          <div className="mt-5 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
            <label className="block text-sm">نام گرگ<input className="field mt-1" value={s.petName} maxLength={20} onChange={e => patch({ petName: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.petEnabled} onChange={e => patch({ petEnabled: e.target.checked })} />نمایش بازی گرگ در داشبورد</label>
          </div>
        </Card>
      </div>
    </div>
  );
}
