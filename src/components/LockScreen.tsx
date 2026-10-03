import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { afterAttempt, normalizeSecret, readLock, verifySecret, waitLeft, wipeEverything, writeLock } from '../services/lock';
import { faNum } from '../ui';

/** Full-screen lock. The app itself is not rendered while this is shown. */
export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [cfg, setCfg] = useState(readLock());
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(() => (cfg ? waitLeft(cfg) : 0));
  const [forgot, setForgot] = useState(false);
  const [confirm, setConfirm] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, [forgot]);
  useEffect(() => {
    if (!cfg || left <= 0) return;
    const t = setInterval(() => setLeft(waitLeft(cfg)), 500);
    return () => clearInterval(t);
  }, [cfg, left > 0]);

  if (!cfg) return null;
  const submit = async () => {
    if (busy || left > 0 || !secret) return;
    setBusy(true);
    const ok = await verifySecret(cfg, normalizeSecret(secret));
    const next = afterAttempt(cfg, ok);
    writeLock(next); setCfg(next); setSecret('');
    if (ok) { onUnlock(); return; }
    setErr('رمز اشتباه است'); setLeft(waitLeft(next)); setBusy(false); input.current?.focus();
  };
  const wipe = async () => { await wipeEverything(); location.reload(); };

  return (
    <div className="fixed inset-0 z-[300] grid place-items-center p-4" style={{ background: 'radial-gradient(circle at 50% 30%,#1b0d33,#05020a 70%)' }} role="dialog" aria-label="قفل برنامه">
      <div className="w-full max-w-sm text-center text-white">
        <img src="./icon-192.png" alt="" className="w-20 h-20 rounded-2xl mx-auto shadow-lg shadow-violet-500/30" />
        <h1 className="text-xl font-extrabold mt-4">Amir OS</h1>
        {!forgot ? (
          <>
            <p className="text-sm text-violet-200/70 mt-1 flex items-center justify-center gap-1"><Lock size={14} />{cfg.kind === 'pin' ? 'رمز عددی را وارد کن' : 'رمز را وارد کن'}</p>
            <form onSubmit={e => { e.preventDefault(); submit(); }} className="mt-5">
              <input ref={input} value={secret} onChange={e => { setSecret(e.target.value); setErr(''); }} type="password" inputMode={cfg.kind === 'pin' ? 'numeric' : 'text'} autoComplete="current-password"
                aria-label="رمز ورود" className="field text-center text-xl tracking-[0.4em]" dir="ltr" maxLength={64} disabled={left > 0} />
              <button type="submit" disabled={busy || left > 0 || !secret} className="w-full mt-3 py-2.5 rounded-xl font-bold text-white disabled:opacity-50" style={{ background: 'linear-gradient(90deg,#6d28d9,#a855f7)' }}>{busy ? 'در حال بررسی…' : 'ورود'}</button>
            </form>
            <p className="text-sm text-rose-300 mt-3 min-h-[1.5em]" role="alert">{left > 0 ? `چند بار اشتباه زدی؛ ${faNum(Math.ceil(left / 1000))} ثانیه صبر کن` : err}</p>
            <button onClick={() => setForgot(true)} className="text-xs text-violet-300/80 hover:text-white mt-4">رمز را فراموش کرده‌ام</button>
          </>
        ) : (
          <div className="mt-4 text-start text-sm leading-7">
            <p>رمز فقط روی همین دستگاه است و راه بازیابی ندارد. تنها راه، <b>پاک‌کردن همهٔ داده‌های برنامه</b> روی این دستگاه است (کارها، یادداشت‌ها، همه‌چیز). اگر فایل پشتیبان JSON داری، بعد از پاک‌کردن می‌توانی از تنظیمات واردش کنی.</p>
            <label className="block mt-3 text-xs text-violet-200/80">برای تأیید بنویس «پاک کن»<input value={confirm} onChange={e => setConfirm(e.target.value)} className="field mt-1" /></label>
            <button onClick={wipe} disabled={confirm.trim() !== 'پاک کن'} className="w-full mt-3 py-2.5 rounded-xl font-bold text-white disabled:opacity-40" style={{ background: '#be123c' }}>پاک‌کردن داده‌ها و حذف قفل</button>
            <button onClick={() => { setForgot(false); setConfirm(''); }} className="w-full mt-2 text-xs text-violet-300/80">برگشت</button>
          </div>
        )}
      </div>
    </div>
  );
}
