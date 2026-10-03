import { useEffect, useState } from 'react';
import { AlertTriangle, Cloud, CloudOff, Copy, Link2, RefreshCw, UploadCloud } from 'lucide-react';
import { Card, Modal } from '../ui';
import { faDigits } from '../services/jalali';
import { DEFAULT_PATH, SyncError, fetchRemote, makePairLink, newDeviceId, newSecret, pairToConfig, parsePair, repoInfo, writeSync } from '../services/sync';
import type { Pair, SyncConfig } from '../services/sync';
import { useSyncCtl } from './useSync';

const when = (t: number | null) => (t ? new Date(t).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—');
const whenIso = (iso: string) => new Date(iso).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });

/** Tiny status icon for the header; opens the sync settings. */
export function SyncBadge({ go }: { go: () => void }) {
  const s = useSyncCtl();
  if (!s.cfg) return null;
  const [Icon, color, label] = s.phase === 'syncing' ? [RefreshCw, 'text-violet-300 animate-spin', 'در حال همگام‌سازی…']
    : s.phase === 'error' ? [AlertTriangle, 'text-rose-400', s.error ?? 'خطا']
    : s.phase === 'offline' ? [CloudOff, 'text-amber-400', 'آفلاین؛ بعد از وصل شدن اینترنت همگام می‌شود']
    : s.conflict ? [AlertTriangle, 'text-amber-400', 'نیاز به تصمیم شما']
    : [Cloud, 'text-emerald-400', `همگام‌سازی فعال · آخرین بار ${when(s.lastAt)}`];
  return <button className="btn p-2" onClick={go} aria-label="همگام‌سازی" title={label}><Icon size={18} className={color} /></button>;
}

/** Asks what to do when this device and the cloud copy both changed (or a new device meets existing cloud data). */
export function SyncConflictModal() {
  const s = useSyncCtl(); const k = s.conflict;
  if (!k) return null;
  return (
    <Modal title={k.first ? 'اطلاعات قبلی روی ابر پیدا شد' : 'هر دو طرف تغییر کرده‌اند'} onClose={s.dismissConflict}>
      <p className="text-sm muted leading-7">
        {k.first ? 'در مخزن شما از قبل اطلاعاتی هست (آخرین ذخیره: ' : 'نسخهٔ ابر هم عوض شده (آخرین ذخیره: '}{whenIso(k.at)}{'، دستگاه '}<bdi dir="ltr">{k.device}</bdi>{'). چه کنیم؟ در هر حالت یک نسخهٔ پشتیبان از داده‌ای که جایش عوض می‌شود روی همین دستگاه می‌ماند.'}
      </p>
      <div className="mt-4 space-y-2">
        <button onClick={() => s.resolve('merge')} className="w-full text-start rounded-xl p-3 border border-violet-400/40 bg-violet-500/10 hover:bg-violet-500/20">
          <b>ادغام هر دو (پیشنهادی)</b><span className="block text-xs muted mt-1">همهٔ کارها، نوت‌ها و ثبت‌ها از هر دو طرف می‌ماند. فقط چیزهایی که یک‌جا پاک کرده‌ای ممکن است برگردد.</span>
        </button>
        <button onClick={() => s.resolve('remote')} className="w-full text-start rounded-xl p-3 border hover:bg-white/5" style={{ borderColor: 'var(--border)' }}>
          <b>داده‌های ابر را بگیر</b><span className="block text-xs muted mt-1">اطلاعات همین دستگاه با نسخهٔ ابر عوض می‌شود. برای گوشی تازه‌نصب مناسب است.</span>
        </button>
        <button onClick={() => s.resolve('local')} className="w-full text-start rounded-xl p-3 border hover:bg-white/5" style={{ borderColor: 'var(--border)' }}>
          <b>همین دستگاه را نگه دار</b><span className="block text-xs muted mt-1">نسخهٔ ابر با اطلاعات این دستگاه جایگزین می‌شود.</span>
        </button>
        <button onClick={s.dismissConflict} className="w-full text-xs muted py-2">بعداً (تا دستی همگام نکنی، چیزی ارسال یا دریافت نمی‌شود)</button>
      </div>
    </Modal>
  );
}

/** Opened via the pairing link from another device (…#sync=…). */
export function JoinPrompt() {
  const [pair, setPair] = useState<Pair | null>(null);
  useEffect(() => {
    const p = parsePair(location.hash);
    if (p) { setPair(p); history.replaceState(null, '', location.pathname + location.search); }
  }, []);
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (!pair) return null;
  const join = async () => {
    setBusy(true); setMsg(null);
    try { const cfg = pairToConfig(pair); await verify(cfg); writeSync(cfg); setPair(null); } catch (e) { setMsg(e instanceof Error ? e.message : 'اتصال انجام نشد'); } finally { setBusy(false); }
  };
  return (
    <Modal title="اتصال این دستگاه به همگام‌سازی" onClose={() => setPair(null)}>
      <p className="text-sm muted leading-7">این لینک از یکی از دستگاه‌های خودت آمده. با اتصال، اطلاعات این دستگاه با مخزن خصوصی <bdi dir="ltr" className="text-white">{pair.o}/{pair.r}</bdi> همگام می‌شود.</p>
      {msg && <p className="text-sm text-rose-400 mt-3">{msg}</p>}
      <div className="flex gap-2 mt-4"><button disabled={busy} onClick={join} className="btn-primary px-5 py-2 rounded-xl font-bold text-white" style={{ background: 'linear-gradient(90deg,#6d28d9,#a855f7)' }}>{busy ? 'در حال اتصال…' : 'اتصال'}</button><button className="btn" onClick={() => setPair(null)}>لغو</button></div>
    </Modal>
  );
}

async function verify(cfg: SyncConfig) {
  const info = await repoInfo(cfg);
  if (!info.private) throw new SyncError('repo', 'این مخزن عمومی (Public) است. برای امنیت اطلاعاتت باید مخزن را Private بسازی.');
  if (!info.canPush) throw new SyncError('token', 'توکن اجازهٔ نوشتن در این مخزن را ندارد (باید Contents: Read and write داشته باشد).');
  await fetchRemote(cfg);
}

export default function SyncSettings() {
  const s = useSyncCtl(); const cfg = s.cfg;
  const [owner, setOwner] = useState(''); const [repo, setRepo] = useState('amir-os-data'); const [token, setToken] = useState('');
  const [link, setLink] = useState(''); const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null); const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState('');
  const say = (t: string, ok = true) => setMsg({ t, ok });

  const connect = async () => {
    if (!owner.trim() || !repo.trim() || !token.trim()) return say('نام کاربری، نام مخزن و توکن را پر کن', false);
    setBusy(true); setMsg(null);
    try {
      const c: SyncConfig = { owner: owner.trim(), repo: repo.trim(), token: token.trim(), secret: newSecret(), path: DEFAULT_PATH, device: newDeviceId() };
      await verify(c); writeSync(c); setToken(''); say('وصل شد. اولین همگام‌سازی شروع شد.');
    } catch (e) { say(e instanceof Error ? e.message : 'اتصال انجام نشد', false); } finally { setBusy(false); }
  };
  const joinByLink = async () => {
    const p = parsePair(link.includes('#') ? link.slice(link.indexOf('#')) : '#sync=' + link.trim());
    if (!p) return say('این لینک معتبر نیست', false);
    setBusy(true); setMsg(null);
    try { const c = pairToConfig(p); await verify(c); writeSync(c); setLink(''); say('وصل شد.'); } catch (e) { say(e instanceof Error ? e.message : 'اتصال انجام نشد', false); } finally { setBusy(false); }
  };
  const pairLink = cfg ? makePairLink(cfg, location.origin + location.pathname) : '';
  const copy = async () => { try { await navigator.clipboard.writeText(pairLink); say('لینک کپی شد. آن را در «پیام‌های ذخیره‌شده»ی تلگرام برای خودت بفرست و روی گوشی باز کن.'); } catch { setShown(pairLink); say('کپی خودکار ممکن نشد؛ لینک را از کادر زیر کپی کن.', false); } };

  return (
    <Card>
      <h3 className="font-bold flex items-center gap-2"><UploadCloud size={18} className="accent" />همگام‌سازی بین دستگاه‌ها (موبایل و کامپیوتر)</h3>
      {!cfg ? (
        <div className="mt-3 space-y-4 max-w-xl">
          <ol className="text-sm muted leading-7 list-decimal ps-5 space-y-1">
            <li>در گیت‌هاب یک مخزن <b className="text-white">Private</b> بساز (مثلاً با نام <bdi dir="ltr">amir-os-data</bdi>).</li>
            <li>در Settings ← Developer settings ← Fine-grained tokens یک توکن بساز: فقط همان مخزن را انتخاب کن و دسترسی <bdi dir="ltr" className="text-white">Contents: Read and write</bdi> بده.</li>
            <li>نام کاربری، نام مخزن و توکن را اینجا بزن. اطلاعات قبل از ارسال روی خود دستگاه رمزنگاری می‌شود.</li>
            <li>برای گوشی، «لینک اتصال» را از بخش بعدی بگیر و روی گوشی باز کن؛ دیگر چیزی لازم نیست تایپ کنی.</li>
          </ol>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="field" dir="ltr" placeholder="نام کاربری گیت‌هاب" aria-label="نام کاربری گیت‌هاب" value={owner} onChange={e => setOwner(e.target.value)} autoComplete="off" />
            <input className="field" dir="ltr" placeholder="نام مخزن خصوصی" aria-label="نام مخزن" value={repo} onChange={e => setRepo(e.target.value)} autoComplete="off" />
          </div>
          <input className="field" dir="ltr" type="password" placeholder="توکن گیت‌هاب (github_pat_…)" aria-label="توکن گیت‌هاب" value={token} onChange={e => setToken(e.target.value)} autoComplete="off" />
          <button onClick={connect} disabled={busy} className="btn-primary px-5 py-2 rounded-xl font-bold text-white" style={{ background: 'linear-gradient(90deg,#6d28d9,#a855f7)' }}>{busy ? 'در حال بررسی…' : 'اتصال و فعال‌سازی'}</button>
          <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm muted mb-2">لینک اتصال از دستگاه دیگر را داری؟</p>
            <div className="flex gap-2"><input className="field" dir="ltr" placeholder="لینک اتصال را بچسبان" aria-label="لینک اتصال" value={link} onChange={e => setLink(e.target.value)} /><button onClick={joinByLink} disabled={busy || !link.trim()} className="btn"><Link2 size={16} /> اتصال</button></div>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3 max-w-xl">
          <p className={`text-sm ${s.phase === 'error' ? 'text-rose-400' : s.phase === 'offline' ? 'text-amber-400' : 'text-emerald-400'}`}>
            {s.phase === 'error' ? `⚠ ${s.error}` : s.phase === 'offline' ? `آفلاین: ${s.error}` : s.phase === 'syncing' ? 'در حال همگام‌سازی…' : `✓ فعال · آخرین همگام‌سازی ساعت ${faDigits(when(s.lastAt))}`}
          </p>
          <p className="text-xs muted">مخزن: <bdi dir="ltr">{cfg.owner}/{cfg.repo}</bdi> · تغییرات چند ثانیه بعد خودکار ارسال می‌شود و هر یک دقیقه (و هر بار که برنامه را باز می‌کنی) نسخهٔ جدید گرفته می‌شود.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => s.syncNow()} className="btn text-sm" disabled={s.phase === 'syncing'}><RefreshCw size={14} /> همین حالا همگام کن</button>
            <button onClick={copy} className="btn text-sm"><Copy size={14} /> کپی لینک اتصال موبایل</button>
            <button onClick={() => { if (confirm('اتصال این دستگاه قطع شود؟ اطلاعات همین دستگاه می‌ماند و فایل ابر هم پاک نمی‌شود.')) { writeSync(null); setShown(''); } }} className="btn text-sm">قطع اتصال</button>
          </div>
          {shown && <input readOnly className="field" dir="ltr" value={shown} onFocus={e => e.currentTarget.select()} aria-label="لینک اتصال" />}
          <p className="text-[11px] muted leading-6">لینک اتصال مثل رمز است (توکن و کلید رمزنگاری داخلش هست)؛ برای کسی نفرست. اگر دستگاهی گم شد، توکن را در گیت‌هاب حذف کن و دوباره وصل شو.</p>
        </div>
      )}
      {msg && <p className={`text-sm mt-3 ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.t}</p>}
    </Card>
  );
}
