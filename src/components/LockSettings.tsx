import { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { Card } from '../ui';
import { createLock, lockSupported, readLock, validateSecret, verifySecret, writeLock } from '../services/lock';
import type { LockKind } from '../services/lock';

const IDLE: [number, string][] = [[0, 'هیچ‌وقت (فقط با دکمهٔ قفل)'], [-1, 'هر بار که از برنامه بیرون می‌روم'], [1, 'بعد از ۱ دقیقه بی‌کاری'], [5, 'بعد از ۵ دقیقه بی‌کاری'], [15, 'بعد از ۱۵ دقیقه بی‌کاری']];

export default function LockSettings({ onLockNow }: { onLockNow: () => void }) {
  const [cfg, setCfg] = useState(readLock);
  const [kind, setKind] = useState<LockKind>('pin');
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [cur, setCur] = useState('');
  const [idle, setIdle] = useState(5);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [mode, setMode] = useState<'idle' | 'change' | 'off'>('idle');
  const [busy, setBusy] = useState(false);
  const reset = () => { setA(''); setB(''); setCur(''); setMode('idle'); };
  const done = (t: string, ok = true) => setMsg({ t, ok });

  if (!lockSupported()) return <Card><h3 className="font-bold flex items-center gap-2"><Lock size={18} className="accent" />قفل برنامه</h3><p className="text-sm muted mt-2">این مرورگر/آدرس از رمزنگاری امن پشتیبانی نمی‌کند (آدرس باید https یا localhost باشد).</p></Card>;

  const enable = async () => {
    const bad = validateSecret(a, kind); if (bad) return done(bad, false);
    if (a !== b) return done('تکرار رمز یکسان نیست', false);
    setBusy(true); const c = await createLock(a, kind, idle); writeLock(c); setCfg(c); setBusy(false); reset(); done('قفل فعال شد. از این به بعد موقع باز کردن برنامه رمز می‌خواهد.');
  };
  const change = async () => {
    if (!cfg || !(await verifySecret(cfg, cur))) return done('رمز فعلی اشتباه است', false);
    const bad = validateSecret(a, kind); if (bad) return done(bad, false);
    if (a !== b) return done('تکرار رمز یکسان نیست', false);
    setBusy(true); const c = await createLock(a, kind, cfg.idle); writeLock(c); setCfg(c); setBusy(false); reset(); done('رمز تغییر کرد.');
  };
  const off = async () => {
    if (!cfg || !(await verifySecret(cfg, cur))) return done('رمز فعلی اشتباه است', false);
    writeLock(null); setCfg(null); reset(); done('قفل غیرفعال شد.');
  };
  const setIdleCfg = (v: number) => { if (!cfg) return; const c = { ...cfg, idle: v }; writeLock(c); setCfg(c); };

  return (
    <Card>
      <h3 className="font-bold flex items-center gap-2"><ShieldCheck size={18} className="accent" />قفل برنامه (رمز ورود)</h3>
      {!cfg ? (
        <div className="space-y-3 mt-3 max-w-sm">
          <div className="flex gap-2">{([['pin', 'رمز عددی'], ['password', 'رمز متنی']] as const).map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={`btn text-sm ${kind === k ? '!bg-violet-600 !text-white' : ''}`}>{l}</button>)}</div>
          <input type="password" className="field" dir="ltr" placeholder={kind === 'pin' ? 'رمز ۴ تا ۸ رقمی' : 'رمز (حداقل ۶ نویسه)'} inputMode={kind === 'pin' ? 'numeric' : 'text'} value={a} onChange={e => setA(e.target.value)} aria-label="رمز جدید" autoComplete="new-password" />
          <input type="password" className="field" dir="ltr" placeholder="تکرار رمز" inputMode={kind === 'pin' ? 'numeric' : 'text'} value={b} onChange={e => setB(e.target.value)} aria-label="تکرار رمز" autoComplete="new-password" />
          <label className="block text-sm">قفل خودکار<select className="field mt-1" value={idle} onChange={e => setIdle(Number(e.target.value))}>{IDLE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <button onClick={enable} disabled={busy} className="btn-primary px-5 py-2 rounded-xl font-bold text-white" style={{ background: 'linear-gradient(90deg,#6d28d9,#a855f7)' }}>{busy ? 'در حال ساخت…' : 'فعال‌کردن قفل'}</button>
        </div>
      ) : (
        <div className="space-y-3 mt-3 max-w-sm">
          <p className="text-sm text-emerald-400">✓ قفل فعال است ({cfg.kind === 'pin' ? 'رمز عددی' : 'رمز متنی'})</p>
          <label className="block text-sm">قفل خودکار<select className="field mt-1" value={cfg.idle} onChange={e => setIdleCfg(Number(e.target.value))}>{IDLE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <div className="flex flex-wrap gap-2"><button onClick={onLockNow} className="btn text-sm"><Lock size={14} /> همین حالا قفل کن</button><button onClick={() => { reset(); setMode('change'); }} className="btn text-sm">تغییر رمز</button><button onClick={() => { reset(); setMode('off'); }} className="btn text-sm">غیرفعال‌کردن</button></div>
          {mode !== 'idle' && (
            <div className="space-y-2">
              <input type="password" className="field" dir="ltr" placeholder="رمز فعلی" value={cur} onChange={e => setCur(e.target.value)} aria-label="رمز فعلی" />
              {mode === 'change' && <>
                <div className="flex gap-2">{([['pin', 'عددی'], ['password', 'متنی']] as const).map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={`btn text-xs ${kind === k ? '!bg-violet-600 !text-white' : ''}`}>{l}</button>)}</div>
                <input type="password" className="field" dir="ltr" placeholder="رمز جدید" value={a} onChange={e => setA(e.target.value)} aria-label="رمز جدید" />
                <input type="password" className="field" dir="ltr" placeholder="تکرار رمز جدید" value={b} onChange={e => setB(e.target.value)} aria-label="تکرار رمز جدید" />
              </>}
              <div className="flex gap-2"><button onClick={mode === 'change' ? change : off} disabled={busy} className="btn text-sm !bg-violet-600 !text-white">{mode === 'change' ? 'ذخیرهٔ رمز جدید' : 'غیرفعال کن'}</button><button onClick={reset} className="btn text-sm">انصراف</button></div>
            </div>
          )}
        </div>
      )}
      {msg && <p className={`text-sm mt-3 ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`} role="status">{msg.t}</p>}
      <p className="text-[11px] muted mt-4 leading-6">این قفل جلوی کسی را می‌گیرد که گوشی یا کامپیوترت را برمی‌دارد، اما داده‌های داخل مرورگر را رمزنگاری نمی‌کند. رمز فقط روی همین دستگاه (به‌صورت هش) ذخیره می‌شود، در پشتیبان JSON نیست و راه بازیابی ندارد. اگر فراموشش کنی باید داده‌های برنامه را پاک کنی؛ پس پشتیبان بگیر.</p>
    </Card>
  );
}
