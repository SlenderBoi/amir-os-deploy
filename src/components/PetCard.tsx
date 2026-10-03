import { ChevronLeft } from 'lucide-react';
import { Card } from '../ui';
import { stageGlow, useGame } from './useGame';
import { BossBar, PetHero, QuestList } from './PetParts';

/** Dashboard game card: wolf + XP ring, today's quests, weekly boss. Details live on the "نُکس" page. */
export default function PetCard({ go }: { go: (p: any) => void }) {
  const { data, g } = useGame();
  if (!data.settings.petEnabled) return null;
  return (
    <Card className="relative overflow-hidden !p-0 pet-stage" >
      <div className="absolute inset-0 pet-aura" aria-hidden style={{ ['--glow' as string]: stageGlow(g.xp.level) }} />
      <div className="relative p-4 md:p-6 space-y-5">
        <PetHero />
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
          <QuestList g={g} go={go} />
          <BossBar boss={g.boss} />
        </div>
        <button onClick={() => go('pet')} className="flex items-center gap-1 text-xs text-violet-300 hover:text-white mx-auto">دستاوردها، زنجیره و جزئیات XP<ChevronLeft size={14} /></button>
      </div>
    </Card>
  );
}
