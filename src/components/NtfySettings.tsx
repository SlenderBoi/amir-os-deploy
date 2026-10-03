import { useState } from 'react';
import { BellRing, Copy, ExternalLink, RefreshCw, Send } from 'lucide-react';
import { Card, faNum } from '../ui';
import { useStore } from '../store';
import { cancelAll, configProblem, ledgerKey, localStore, normalizeServer, ntfyConfig, randomTopic, sendTest } from '../services/ntfy';
import { runSync } from '../services/ntfySync';
import { faDigits, formatJalali } from '../services/jalali';
import { useSyncStatus } from './useNtfySync';
import { localISO } from '../services/dates';
import type { NtfyConfig } from '../types';

const Row = ({ children }: { children: React.ReactNode }) => <div className="flex items-center justify-between gap-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>{children}</div>;
const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="w-11 h-6 rounded-full relative shrink-0 transition" style={{ background: on ? 'var(--accent)' : 'var(--panel2)', border: '1px solid var(--border)' }}>
    <i className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ right: on ? '1.25rem' : '0.125rem' }} />
  </button>
);

export default function NtfySettings() {
  const { data, setData } = useStore();
  const cfg = ntfyConfig(data.settings.ntfy);
  const status = useSyncStatus();
  const [busy, setBusy] = useState<'' | 'test' | 'sync' | 'off'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const problem = configProblem(cfg);
  const patch = (x: Partial<NtfyConfig>) => setData(d => ({ ...d, settings: { ...d.settings, ntfy: { ...ntfyConfig(d.settings.ntfy), ...x } } }));
  const latest = () => data;

  const host = (() => { try { return new URL(normalizeServer(cfg.server)).host; } catch { return 'ntfy.sh'; } })();
  const subscribeLink = `ntfy://${host}/${cfg.topic}`;

  const enable = async () => {
    const topic = cfg.topic || randomTopic();
    patch({ enabled: true, topic });
    setMsg({ ok: true, text: 'فعال شد. حالا مرحلهٔ ۲ و ۳ بالا را انجام بده و «ارسال تست» را بزن.' });
    // sync with the new settings once state has settled
    setTimeout(() => void runSync(() => ({ ...latest(), settings: { ...latest().settings, ntfy: { ...cfg, enabled: true, topic } } })), 300);
  };
  const disable = async () => {
    setBusy('off');
    const n = await cancelAll(cfg, localStore(ledgerKey(cfg)));
    patch({ enabled: false });
    setMsg({ ok: true, text: n ? `${faNum(n)} یادآور زمان‌بندی‌شده لغو شد.` : 'خاموش شد.' });
    setBusy('');
  };
  const test = async () => {
    if (problem) { setMsg({ ok: false, text: problem }); return; }
    setBusy('test'); const ok = await sendTest(cfg); setBusy('');
    setMsg(ok ? { ok: true, text: 'پیام تست فرستاده شد. اگر روی گوشی نیامد، مطمئن شو در اپ ntfy همین تاپیک را Subscribe کرده‌ای.' } : { ok: false, text: 'ارسال ناموفق بود. اینترنت و آدرس سرور را بررسی کن.' });
  };
  const sync = async () => { setBusy('sync'); await runSync(() => data); setBusy(''); };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setMsg({ ok: true, text: 'کپی شد.' }); } catch { setMsg({ ok: false, text: 'کپی نشد؛ دستی انتخابش کن.' }); } };
  const newTopic = async () => {
    if (cfg.enabled) { if (!confirm('تاپیک عوض شود؟ باید دوباره در اپ ntfy روی تاپیک جدید Subscribe کنی. یادآورهای قبلی لغو می‌شوند.')) return; await cancelAll(cfg, localStore(ledgerKey(cfg))); }
    patch({ topic: randomTopic() });
  };

  return (
    <Card>
      <div className="flex gap-2 items-center"><span className="accent"><BellRing /></span><h3 className="font-bold">اعلان روی موبایل (ntfy)</h3></div>
      <p className="text-sm muted mt-3 leading-7">اعلان‌ها حتی وقتی Amir OS بسته است روی گوشی می‌رسند. اپ، یادآورهای ۳ روز آینده را روی سرور رایگان ntfy زمان‌بندی می‌کند و اپ ntfy گوشی‌ات آن‌ها را نشان می‌دهد؛ بدون هیچ سرور اختصاصی.</p>

      <ol className="text-sm mt-3 space-y-1.5 list-decimal pr-5 leading-7">
        <li>اپ <b>ntfy</b> را نصب کن (Google Play / F-Droid / App Store).</li>
        <li>در اپ روی + بزن و تاپیک پایین را <b>Subscribe</b> کن{cfg.topic && <> — یا <a className="accent underline" href={subscribeLink}>این لینک</a> را روی گوشی باز کن</>}.</li>
        <li>اینجا «فعال‌سازی» و بعد «ارسال تست» را بزن.</li>
      </ol>

      <div className="grid md:grid-cols-2 gap-3 mt-4">
        <label className="text-sm">سرور<input className="field mt-1" dir="ltr" value={cfg.server} onChange={e => patch({ server: e.target.value })} /></label>
        <div className="text-sm">تاپیک (مثل رمز عبور است)
          <div className="flex gap-2 mt-1">
            <input className="field" dir="ltr" value={cfg.topic} onChange={e => patch({ topic: e.target.value.trim() })} placeholder="با فعال‌سازی خودکار ساخته می‌شود" />
            <button className="btn p-2 shrink-0" aria-label="کپی تاپیک" onClick={() => copy(cfg.topic)} disabled={!cfg.topic}><Copy size={16} /></button>
            <button className="btn p-2 shrink-0" aria-label="تاپیک تصادفی جدید" title="تاپیک تصادفی جدید" onClick={newTopic}><RefreshCw size={16} /></button>
          </div>
        </div>
      </div>
      <details className="mt-2 text-sm"><summary className="muted cursor-pointer">پیشرفته: توکن دسترسی (برای سرور شخصی)</summary>
        <input className="field mt-2" dir="ltr" type="password" value={cfg.token} onChange={e => patch({ token: e.target.value.trim() })} placeholder="tk_…" autoComplete="off" /></details>

      <div className="mt-4">
        <Row><span className="text-sm">خلاصهٔ صبح (کارها، بلوک‌ها، مرورها، تعطیلی)</span><div className="flex items-center gap-2"><input type="time" className="field !w-36" value={cfg.digestTime} onChange={e => patch({ digestTime: e.target.value })} disabled={!cfg.digest} aria-label="ساعت خلاصه صبح" /><Toggle on={cfg.digest} onChange={v => patch({ digest: v })} label="خلاصه صبح" /></div></Row>
        <Row><span className="text-sm">قبل از شروع هر بلوک زمانی</span><div className="flex items-center gap-2">
          <select className="field !w-36" value={cfg.eventLead} onChange={e => patch({ eventLead: Number(e.target.value) })} disabled={!cfg.events} aria-label="چند دقیقه قبل">{[0, 5, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m ? `${faNum(m)} دقیقه` : 'سر وقت'}</option>)}</select>
          <Toggle on={cfg.events} onChange={v => patch({ events: v })} label="یادآور بلوک زمانی" /></div></Row>
        <Row><span className="text-sm">یادآور شبانه (عادت‌ها و لاگ یادگیری)</span><div className="flex items-center gap-2"><input type="time" className="field !w-36" value={cfg.eveningTime} onChange={e => patch({ eveningTime: e.target.value })} disabled={!cfg.evening} aria-label="ساعت یادآور شبانه" /><Toggle on={cfg.evening} onChange={v => patch({ evening: v })} label="یادآور شبانه" /></div></Row>
        <Row><span className="text-sm">مرور هفتگی (جمعه ۱۷:۰۰)</span><Toggle on={cfg.weeklyReview} onChange={v => patch({ weeklyReview: v })} label="مرور هفتگی" /></Row>
        <Row><div><div className="text-sm">نمایش عنوان کارها در اعلان</div><div className="text-[11px] muted mt-0.5">خاموش = فقط تعداد (امن‌تر). هر کسی تاپیک را بداند پیام‌ها را می‌خواند.</div></div><Toggle on={cfg.showTitles} onChange={v => patch({ showTitles: v })} label="نمایش عنوان" /></Row>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {!cfg.enabled
          ? <button className="btn btn-primary" onClick={enable}><BellRing size={16} />فعال‌سازی</button>
          : <button className="btn" onClick={disable} disabled={busy === 'off'}>خاموش کردن و لغو زمان‌بندی‌ها</button>}
        <button className="btn" onClick={test} disabled={!!busy || !cfg.topic}><Send size={16} />ارسال تست</button>
        {cfg.enabled && <button className="btn" onClick={sync} disabled={!!busy}><RefreshCw size={16} />همگام‌سازی حالا</button>}
        <a className="btn" href="https://docs.ntfy.sh/subscribe/phone/" target="_blank" rel="noreferrer"><ExternalLink size={16} />راهنمای ntfy</a>
      </div>

      {msg && <div className={`mt-3 text-sm ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`} role="status">{msg.text}</div>}
      {cfg.enabled && problem && <div className="mt-3 text-sm text-rose-400">{problem}</div>}
      {cfg.enabled && status && (
        <div className="mt-3 rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--panel2)' }} data-testid="ntfy-status">
          <div>{status.error ? <span className="text-amber-400">{status.error}</span> : <>✓ {faNum(status.result?.scheduled ?? 0)} یادآور روی ntfy زمان‌بندی شده</>}</div>
          {status.next && <div className="muted text-xs">بعدی: {status.next.title} · {formatJalali(localISO(new Date(status.next.at)), { year: false })} ساعت {faDigits(new Date(status.next.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}</div>}
          <div className="muted text-xs">آخرین همگام‌سازی: {faDigits(new Date(status.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}{status.result ? ` · ${faNum(status.result.published)} ارسال، ${faNum(status.result.cancelled)} لغو` : ''}</div>
        </div>
      )}

      <ul className="mt-4 text-xs muted space-y-1.5 leading-6 list-disc pr-5">
        <li>ntfy فقط ۳ روز جلوتر زمان‌بندی می‌کند؛ هر چند روز یک بار اپ را باز کن تا پنجره جلو برود (با هر بار باز کردن خودکار انجام می‌شود).</li>
        <li>فقط از <b>یک دستگاه</b> همگام کن؛ داده‌ها بین دستگاه‌ها هم‌گام نیستند و دو دستگاه یادآور هم را لغو/تکراری می‌کنند.</li>
        <li>سرور رایگان ntfy.sh روزی حدود ۲۵۰ پیام اجازه می‌دهد؛ اپ فقط تغییرات را می‌فرستد.</li>
        <li>در iPhone اعلان از اپ ntfy می‌آید و باید اجازهٔ اعلان به آن داده شده باشد.</li>
      </ul>
    </Card>
  );
}
