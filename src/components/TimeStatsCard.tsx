import { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { useStore } from '../store';
import { Card, faNum } from '../ui';
import { estimateAdvice, timeStats } from '../services/timer';

const hm = (min: number) => (min >= 60 ? `${faNum(Math.floor(min / 60))} ساعت${min % 60 ? ` و ${faNum(min % 60)} دقیقه` : ''}` : `${faNum(min)} دقیقه`);

export default function TimeStatsCard() {
  const { data } = useStore();
  const s = useMemo(() => timeStats(data), [data.timeEntries, data.tasks]);
  return (
    <Card>
      <div className="grid sm:grid-cols-3 gap-4 items-center">
        <div><p className="text-xs muted">زمان ثبت‌شده امروز</p><b className="text-xl block mt-1">{hm(s.today)}</b></div>
        <div><p className="text-xs muted">۷ روز اخیر</p><b className="text-xl block mt-1">{hm(s.week)}</b></div>
        <div className="flex gap-2 items-start text-xs"><Gauge size={18} className="accent shrink-0 mt-0.5" /><p className="muted leading-6">{estimateAdvice(s.ratio)}</p></div>
      </div>
    </Card>
  );
}
