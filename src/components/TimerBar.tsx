import { useEffect, useState } from 'react';
import { Square, Timer, X } from 'lucide-react';
import { useStore } from '../store';
import { elapsedSeconds, formatClock, stopTimer } from '../services/timer';

export const LEARNING_DRAFT_KEY = 'amir-os:learning-draft';
export const LEARNING_DRAFT_EVENT = 'amir-os:learning-draft';

/** Floating pill for the single running timer. The timer lives in the DB, so it survives reloads and closed tabs. */
export default function TimerBar({ go }: { go: (page: string) => void }) {
  const { data, setData } = useStore();
  const timer = data.timer;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!timer) { document.title = 'Amir OS'; return; }
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(i); document.title = 'Amir OS'; };
  }, [timer]);

  const seconds = timer ? elapsedSeconds(timer, now) : 0;
  useEffect(() => { if (timer) document.title = `⏱ ${formatClock(seconds)} · ${timer.label}`; }, [timer, seconds]);

  if (!timer) return null;

  const stop = () => {
    const result = stopTimer(data);
    setData(result.db);
    if (timer.kind === 'learning' && result.minutes > 0) {
      sessionStorage.setItem(LEARNING_DRAFT_KEY, JSON.stringify({ trackId: timer.refId, minutes: result.minutes }));
      window.dispatchEvent(new Event(LEARNING_DRAFT_EVENT));
      go('learning');
    }
  };
  const discard = () => { if (confirm('این تایمر بدون ثبت زمان دور ریخته شود؟')) setData(d => ({ ...d, timer: null })); };

  return (
    <div className="fixed z-[90] bottom-[84px] md:bottom-5 right-3 left-3 md:left-5 md:right-auto md:w-80 flex items-center gap-3 rounded-2xl px-4 py-3 backdrop-blur-xl pet-stage" role="timer" aria-label="تایمر در حال اجرا">
      <span className="relative grid place-items-center w-9 h-9 rounded-xl shrink-0" style={{ background: 'rgba(139,92,246,.25)' }}>
        <Timer size={18} className="text-violet-200" />
        <i className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
      </span>
      <div className="min-w-0 flex-1 text-white">
        <div className="text-[11px] text-violet-300">{timer.kind === 'task' ? 'روی کار' : 'مطالعهٔ'}</div>
        <div className="text-sm font-bold truncate">{timer.label}</div>
      </div>
      <b className="font-mono text-lg text-white" dir="ltr">{formatClock(seconds)}</b>
      <button onClick={stop} className="btn btn-primary p-2" aria-label="توقف و ثبت زمان" title="توقف و ثبت"><Square size={16} className="fill-current" /></button>
      <button onClick={discard} className="p-1.5 text-violet-300/70 hover:text-rose-400" aria-label="دور انداختن" title="دور انداختن"><X size={16} /></button>
    </div>
  );
}
