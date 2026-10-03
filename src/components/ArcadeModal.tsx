import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { faNum } from '../ui';
import { useStore } from '../store';
import { loadSprites } from '../arcade/engine';
import type { Sprites } from '../arcade/engine';
import { coinsForRun, recordRun, startRun } from '../arcade/rules';
import { lookOf } from '../shop/rules';
import type { GameDef, HudState, Upgrade } from '../arcade/types';

type Phase = 'ready' | 'playing' | 'over';

/** Full-screen player for one pixel game: start screen, HUD, wave upgrades and game-over summary. */
export default function ArcadeModal({ def, onClose }: { def: GameDef; onClose: () => void }) {
  const { data, setData } = useStore();
  const canvas = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [sprites, setSprites] = useState<Sprites | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [hud, setHud] = useState<HudState>({ score: 0, stage: 1, lives: 3 });
  const [banner, setBanner] = useState('');
  const [pick, setPick] = useState<{ opts: Upgrade[]; fn: (i: number) => void } | null>(null);
  const [result, setResult] = useState<{ score: number; stage: number; record: boolean; coins: number } | null>(null);
  const best = data.settings.arcade?.best[def.id] ?? 0;
  const buffs = data.settings.arcade?.buffs ?? 0;

  const look = lookOf(data.settings.shop);
  useEffect(() => { loadSprites(look.skin).then(sp => setSprites({ ...sp, acc: look.acc })).catch(() => setFailed(true)); }, [look.skin]);
  useEffect(() => () => { stopRef.current?.(); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);

  const start = () => {
    if (!sprites || !canvas.current) return;
    stopRef.current?.();
    (document.activeElement as HTMLElement | null)?.blur();
    const run = startRun(data.settings.arcade);
    setData(d => ({ ...d, settings: { ...d.settings, arcade: startRun(d.settings.arcade).arcade } }));
    setHud({ score: 0, stage: 1, lives: run.lives }); setResult(null); setPick(null); setBanner(''); setPhase('playing');
    stopRef.current = def.start(canvas.current, sprites, {
      hud: setHud,
      stage: n => { setBanner(`مرحلهٔ ${faNum(n)}`); setTimeout(() => setBanner(b => (b === `مرحلهٔ ${faNum(n)}` ? '' : b)), 1600); },
      over: r => {
        setData(d => ({ ...d, settings: { ...d.settings, arcade: recordRun(d.settings.arcade, def.id, r.score).arcade } }));
        setResult({ ...r, record: r.score > best, coins: coinsForRun(r.score) }); setPhase('over');
      },
      upgrade: (opts, fn) => setPick({ opts, fn: i => { setPick(null); fn(i); } }),
    }, { lives: run.lives });
  };

  const aspect = def.w / def.h;
  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-3 gap-2" role="dialog" aria-label={def.title}>
      <div className="flex items-center justify-between w-full text-white" style={{ maxWidth: `min(960px, calc((100vh - 130px) * ${aspect}))`, minWidth: 280 }}>
        <div className="flex items-center gap-2 font-bold"><span className="text-xl">{def.icon}</span>{def.title}</div>
        <button onClick={onClose} className="btn p-2" aria-label="بستن بازی"><X size={18} /></button>
      </div>
      {phase !== 'ready' && (
        <div className="flex items-center justify-between w-full text-white text-sm px-1" style={{ maxWidth: `min(960px, calc((100vh - 130px) * ${aspect}))`, minWidth: 280 }}>
          <span>امتیاز <b data-testid="score">{faNum(hud.score)}</b></span>
          <span>مرحله <b>{faNum(hud.stage)}</b></span>
          <span aria-label={`${hud.lives} جان`}>{'❤️'.repeat(Math.max(0, hud.lives)) || '💀'}</span>
        </div>
      )}
      <div className="relative w-full" style={{ maxWidth: `min(960px, calc((100vh - 130px) * ${aspect}))`, minWidth: 280 }}>
        <canvas ref={canvas} width={def.w} height={def.h} className="w-full block rounded-xl border border-violet-500/50 bg-[#0b0615]" style={{ imageRendering: 'pixelated', aspectRatio: `${def.w}/${def.h}`, touchAction: 'none' }} />
        {banner && phase === 'playing' && <div className="absolute inset-x-0 top-[18%] text-center pointer-events-none"><span className="game-toast inline-block rounded-2xl px-5 py-2 text-white font-extrabold text-lg">{banner}</span></div>}
        {phase === 'ready' && (
          <Overlay>
            <div className="text-5xl mb-2">{def.icon}</div>
            <h3 className="text-xl font-extrabold">{def.title}</h3>
            <p className="text-sm text-violet-200/80 mt-2 leading-7">{def.blurb}</p>
            <p className="text-xs text-violet-300 mt-2">🎮 {def.controls}</p>
            {best > 0 && <p className="text-xs mt-2">رکورد تو: <b>{faNum(best)}</b></p>}
            {buffs > 0 && <p className="text-xs mt-1 text-emerald-300">🍖 گرگ سیره: یک جان اضافه در این دور!</p>}
            <button onClick={start} disabled={!sprites && !failed} className="btn-primary mt-4 px-6 py-2.5 rounded-xl font-bold" style={{ background: 'linear-gradient(90deg,#6d28d9,#a855f7)', color: '#fff' }}>{failed ? 'تصاویر بازی بارگذاری نشد' : sprites ? 'شروع' : 'در حال بارگذاری…'}</button>
          </Overlay>
        )}
        {pick && (
          <Overlay>
            <h3 className="text-lg font-extrabold">موج تمام شد! یک ارتقا بگیر</h3>
            <div className="grid gap-2 mt-3 w-full">
              {pick.opts.map((u, i) => <button key={u.id} onClick={() => pick.fn(i)} className="quest-row rounded-xl px-3 py-2.5 flex items-center gap-3 text-start hover:brightness-125"><span className="text-2xl">{u.icon}</span><span><b className="block text-sm">{u.title}</b><span className="text-xs text-violet-200/80">{u.desc}</span></span></button>)}
            </div>
          </Overlay>
        )}
        {phase === 'over' && result && (
          <Overlay>
            <div className="text-4xl mb-1">{result.record ? '🏆' : '💀'}</div>
            <h3 className="text-xl font-extrabold">{result.record ? 'رکورد جدید!' : 'بازی تمام شد'}</h3>
            <p className="mt-2 text-sm">امتیاز: <b data-testid="final">{faNum(result.score)}</b> · مرحله {faNum(result.stage)}</p>
            <p className="text-xs mt-1" style={{ color: '#fde047' }}>+{faNum(result.coins)} 🪙 سکه</p>
            <p className="text-xs text-violet-300 mt-1">رکورد: {faNum(Math.max(best, result.score))}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={start} className="px-5 py-2 rounded-xl font-bold text-white" style={{ background: 'linear-gradient(90deg,#6d28d9,#a855f7)' }}>دوباره</button>
              <button onClick={onClose} className="btn px-5 py-2">خروج</button>
            </div>
          </Overlay>
        )}
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 rounded-xl bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-center text-white p-5">{children}</div>;
}
