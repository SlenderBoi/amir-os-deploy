import { useEffect, useMemo, useState } from 'react';
import { Brain, Lightbulb, PartyPopper } from 'lucide-react';
import { useStore } from '../../store';
import { Modal, faDate, faNum } from '../../ui';
import { localISO } from '../../services/dates';
import { dueCards, GRADE_LABEL, nextState, type Grade, type ReviewCard } from '../../services/srs';

const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];
const dayLabel = (n: number) => (n === 1 ? 'فردا' : `${faNum(n)} روز دیگر`);

/** Active-recall session: see the topic, try to remember, reveal, grade yourself. */
export default function ReviewSession({ close }: { close: () => void }) {
  const { data, setData } = useStore();
  const today = localISO();
  const initial = useMemo(() => dueCards(data, today), []); // snapshot: grading must not reshuffle the queue
  const [queue, setQueue] = useState<ReviewCard[]>(initial);
  const [done, setDone] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = queue[0];

  const grade = (g: Grade) => {
    if (!card) return;
    const state = nextState(data.reviews[card.log.id], g, today);
    setData(d => ({ ...d, reviews: { ...d.reviews, [card.log.id]: state } }));
    setQueue(q => (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)));
    if (g !== 'again') setDone(n => n + 1);
    setRevealed(false);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!card || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRevealed(true); }
      else if (revealed && '1234'.includes(e.key) && e.key) grade(GRADES[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <Modal title="مرور امروز" onClose={close} wide>
      {!initial.length || !card ? (
        <div className="text-center py-10">
          <PartyPopper className="mx-auto accent" size={40} />
          <h3 className="font-bold text-lg mt-4">{initial.length ? 'مرور امروز تمام شد!' : 'امروز چیزی برای مرور نیست.'}</h3>
          <p className="muted text-sm mt-2">{initial.length ? `${faNum(done)} درس مرور شد و زمان مرور بعدی‌شان تنظیم شد.` : 'هر درسی که با نکته یا شرح ثبت کنی، فردایش اینجا برای مرور می‌آید.'}</p>
          <button className="btn btn-primary mt-6" onClick={close}>بستن</button>
        </div>
      ) : (
        <div>
          <div className="flex justify-between text-xs muted mb-2"><span>{faNum(done)} از {faNum(initial.length)}</span><span>باقی‌مانده در صف: {faNum(queue.length)}</span></div>
          <div className="progress mb-5"><i style={{ width: `${(done / initial.length) * 100}%` }} /></div>
          <div className="rounded-2xl p-5 md:p-7 border" style={{ background: 'var(--panel2)', borderColor: card.color }}>
            <span className="chip" style={{ color: card.color }}>{card.trackTitle}</span>
            <h3 className="text-2xl font-extrabold mt-3">{card.log.topic}</h3>
            <p className="text-xs muted mt-1">{faDate(card.log.date)}</p>
            {!revealed ? (
              <div className="mt-6">
                <div className="flex gap-2 items-center text-sm muted"><Brain size={18} className="accent shrink-0" />قبل از دیدن جواب، سعی کن به یاد بیاوری چی یاد گرفتی.</div>
                <button className="btn btn-primary w-full mt-5" onClick={() => setRevealed(true)}>نمایش جواب <kbd className="chip desktop-only">Space</kbd></button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {card.log.notes && <p className="text-sm whitespace-pre-line leading-7">{card.log.notes}</p>}
                {card.log.keyPoints.length > 0 && <ul className="text-sm space-y-1.5">{card.log.keyPoints.map((k, i) => <li key={i}>• {k}</li>)}</ul>}
                {card.log.ideas.length > 0 && <div className="rounded-xl p-3 bg-violet-500/10 text-sm"><span className="flex gap-1 text-xs mb-1"><Lightbulb size={14} className="text-amber-400" />ایده‌ها</span>{card.log.ideas.map((k, i) => <p key={i}>• {k}</p>)}</div>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                  {GRADES.map((g, i) => (
                    <button key={g} className="btn flex-col !gap-0.5 py-3" onClick={() => grade(g)}>
                      <span>{GRADE_LABEL[g]}</span>
                      <span className="text-[11px] muted">{g === 'again' ? 'همین امروز دوباره' : dayLabel(nextState(data.reviews[card.log.id], g, today).interval)} · <span dir="ltr">{i + 1}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
