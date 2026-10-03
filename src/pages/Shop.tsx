import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { Card, faNum } from '../ui';
import { useStore } from '../store';
import { drawWolf, loadSprites } from '../arcade/engine';
import type { Acc } from '../arcade/engine';
import { MAX_BUFFS } from '../arcade/rules';
import PixelPet from '../components/PixelPet';
import { stageGlow, useGame } from '../components/useGame';
import { ITEMS, itemsOf, MEAT_PACK_PRICE } from '../shop/catalog';
import type { Item, ItemKind } from '../shop/catalog';
import { buy, buyMeat, coinBalance, equip, isEquipped, lookOf, owns, unequip } from '../shop/rules';
import type { Look } from '../shop/rules';

type Tab = ItemKind | 'food';
const TABS: [Tab, string][] = [['skin', '🎨 اسکین'], ['acc', '🕶️ اکسسوری'], ['room', '🏞️ اتاق'], ['food', '🍖 غذا']];

/** Little wolf picture for a shop card (skin and/or accessory). */
function Thumb({ skin, acc }: { skin: string; acc?: Acc }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let on = true;
    loadSprites(skin).then(S => {
      const c = ref.current; if (!on || !c) return;
      const ctx = c.getContext('2d')!; ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, c.width, c.height);
      drawWolf(ctx, { ...S, acc }, 0, 16, 80, 55);
    }).catch(() => {});
    return () => { on = false; };
  }, [skin, acc?.head, acc?.face, acc?.neck]);
  return <canvas ref={ref} width={80} height={72} className="mx-auto block" style={{ imageRendering: 'pixelated', width: 96, height: 86 }} />;
}

export default function Shop({ go }: { go: (p: any) => void }) {
  const { setData } = useStore();
  const { data, g } = useGame();
  const [tab, setTab] = useState<Tab>('skin');
  const [tryOn, setTryOn] = useState<Partial<Look> | null>(null);
  const [msg, setMsg] = useState('');
  const shop = data.settings.shop;
  const look = lookOf(shop);
  const shown: Look = { skin: tryOn?.skin ?? look.skin, room: tryOn?.room ?? look.room, acc: { ...look.acc, ...(tryOn?.acc ?? {}) } };
  const buffs = data.settings.arcade?.buffs ?? 0;

  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const preview = (it: Item) => setTryOn(it.kind === 'skin' ? { skin: it.id } : it.kind === 'room' ? { room: it.id } : { acc: { [it.slot!]: it.id } });
  const onBuy = (it: Item) => {
    const r = buy(shop, it, g.coins, g.xp.level);
    if (!r.ok) { say(r.error); return; }
    setData(d => ({ ...d, settings: { ...d.settings, shop: equip(r.shop, it) } }));
    setTryOn(null); say(`«${it.name}» مال تو شد و پوشیده شد! 🎉`);
  };
  const onEquip = (it: Item) => {
    setData(d => ({ ...d, settings: { ...d.settings, shop: it.kind === 'acc' && isEquipped(d.settings.shop, it) ? unequip(d.settings.shop, it.slot!) : equip(d.settings.shop, it) } }));
    setTryOn(null);
  };
  const onMeat = () => {
    const r = buyMeat(data, g.coins);
    if (!r) { say(buffs >= MAX_BUFFS ? 'سه جان اضافه ذخیره داری' : 'سکه‌ات کافی نیست'); return; }
    setData(d => { const x = buyMeat(d, g.coins); return x ? { ...d, settings: { ...d.settings, shop: x.shop, arcade: x.arcade } } : d; });
    say('غذای ویژه خریده شد: یک جان اضافه برای بازی بعدی 🍖');
  };

  const card = (it: Item) => {
    const own = owns(shop, it), eq = isEquipped(shop, it), locked = !own && g.xp.level < it.level;
    const sel = tryOn && ((it.kind === 'skin' && tryOn.skin === it.id) || (it.kind === 'room' && tryOn.room === it.id) || (it.kind === 'acc' && tryOn.acc?.[it.slot!] === it.id));
    return (
      <div key={`${it.kind}-${it.id}`} role="button" tabIndex={0} onClick={() => preview(it)} onKeyDown={e => e.key === 'Enter' && preview(it)}
        className={`quest-row rounded-2xl p-3 text-center text-white cursor-pointer ${sel ? 'ring-2 ring-violet-400' : ''} ${locked ? 'opacity-70' : ''}`}>
        <div className="h-[86px] grid place-items-center">
          {it.kind === 'skin' ? <Thumb skin={it.id} /> : it.kind === 'acc' ? <Thumb skin={look.skin} acc={{ [it.slot!]: it.id }} /> : <span className="text-5xl">{it.icon}</span>}
        </div>
        <div className="font-bold text-sm mt-1">{it.name}</div>
        <div className="text-[11px] text-violet-200/70 min-h-[2.4em]">{it.desc}</div>
        <div className="mt-2" onClick={e => e.stopPropagation()}>
          {own ? (
            <button onClick={() => onEquip(it)} disabled={eq && it.kind !== 'acc'} className="w-full rounded-xl py-1.5 text-xs font-bold" style={{ background: eq ? 'rgba(52,211,153,.2)' : 'rgba(139,92,246,.35)', color: eq ? '#6ee7b7' : '#fff' }}>
              {eq ? (it.kind === 'acc' ? 'درآوردن ✓' : 'در حال استفاده ✓') : it.price === 0 ? 'استفاده' : 'بپوش'}
            </button>
          ) : locked ? (
            <div className="w-full rounded-xl py-1.5 text-xs flex items-center justify-center gap-1 bg-white/5 text-violet-300"><Lock size={12} />سطح {faNum(it.level)}</div>
          ) : (
            <button onClick={() => onBuy(it)} className="w-full rounded-xl py-1.5 text-xs font-bold text-white" style={{ background: g.coins >= it.price ? 'linear-gradient(90deg,#6d28d9,#a855f7)' : 'rgba(255,255,255,.1)' }}>خرید · {faNum(it.price)} 🪙</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <Card className="relative overflow-hidden !p-0 pet-stage">
        <div className="absolute inset-0 pet-aura" aria-hidden style={{ ['--glow' as string]: stageGlow(g.xp.level) }} />
        <div className="relative p-4 md:p-6 grid md:grid-cols-[1.2fr_1fr] gap-4 items-center text-white">
          <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${stageGlow(g.xp.level)}`, boxShadow: `0 0 22px ${stageGlow(g.xp.level)}66` }}>
            <PixelPet look={shown} glow={stageGlow(g.xp.level)} feedTick={0} onPoke={() => {}} label="پیش‌نمایش گرگ" />
          </div>
          <div>
            <div className="text-[11px] text-violet-300">موجودی سکه</div>
            <div className="text-4xl font-extrabold" style={{ color: '#fde047' }} data-testid="coins">{faNum(g.coins)} 🪙</div>
            <p className="text-[11px] text-violet-200/70 mt-2 leading-6">هر ۵ XP کار واقعی = ۱ سکه. بازی‌ها هم تا ۲۵ سکه در هر دور می‌دهند. روی هر کالا بزنی، روی گرگ بالا امتحانش می‌کنی.</p>
            {tryOn && <button onClick={() => setTryOn(null)} className="btn text-xs mt-3">برگشت به ظاهر فعلی</button>}
            {msg && <p className="pet-say text-sm mt-3" role="status">{msg}</p>}
            <button onClick={() => go('pet')} className="text-xs text-violet-300 hover:text-white mt-3 block">← برگشت به نُکس</button>
          </div>
        </div>
      </Card>

      <div className="flex gap-2 overflow-x-auto">{TABS.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`btn text-sm whitespace-nowrap ${tab === id ? '!bg-violet-600 !text-white' : ''}`}>{label}</button>)}</div>

      {tab !== 'food' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{itemsOf(tab).map(card)}</div>
      ) : (
        <Card><div className="flex items-center gap-4 flex-wrap">
          <span className="text-5xl">🍖</span>
          <div className="flex-1 min-w-[200px]"><b>غذای ویژه</b><p className="text-xs muted mt-1">یک جان اضافه برای دور بعدی بازی‌ها (حداکثر {faNum(MAX_BUFFS)} ذخیره). الان داری: {faNum(buffs)}</p></div>
          <button onClick={onMeat} className="px-5 py-2 rounded-xl font-bold text-white" style={{ background: 'linear-gradient(90deg,#6d28d9,#a855f7)' }}>خرید · {faNum(MEAT_PACK_PRICE)} 🪙</button>
        </div></Card>
      )}
      <p className="text-[11px] muted text-center">{faNum(ITEMS.length)} کالا · اسکین‌ها در بازی‌ها هم دیده می‌شوند · خریدها در پشتیبان JSON ذخیره می‌شوند</p>
    </div>
  );
}
