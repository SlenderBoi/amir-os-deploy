import { faNum } from '../../ui';

/** Minimal dependency-free SVG/CSS charts. Time runs left → right (oldest → newest). */

export function StackedBars({ data, colors, height = 170, format }: {
  data: { label: string; title: string; values: number[] }[]; colors: string[]; height?: number; format: (v: number) => string;
}) {
  const W = 720, padL = 34, padB = 18, padT = 8, H = height;
  const max = Math.max(1, ...data.map(d => d.values.reduce((a, b) => a + b, 0)));
  const slot = (W - padL) / data.length, bw = Math.min(26, slot * 0.68);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const every = Math.ceil(data.length / 12);
  return (
    <div className="overflow-x-auto" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 560 }} role="img" aria-label="نمودار ستونی">
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(max * t)} y2={y(max * t)} stroke="var(--border)" strokeDasharray={t ? '3 4' : undefined} />
            <text x={padL - 6} y={y(max * t) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{format(max * t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          let acc = 0; const x = padL + i * slot + (slot - bw) / 2;
          return (
            <g key={i}>
              <title>{`${d.title}: ${d.values.map((v, k) => `${format(v)}`).join(' + ')}`}</title>
              {d.values.map((v, k) => { const h = (H - padT - padB) * v / max; const yy = y(acc + v); acc += v; return v > 0 ? <rect key={k} x={x} y={yy} width={bw} height={Math.max(h, 1)} rx={3} fill={colors[k]} /> : null; })}
              {i % every === 0 && <text x={x + bw / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--muted)">{d.label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function GroupedBars({ data, colors, height = 170, format }: {
  data: { label: string; values: number[] }[]; colors: string[]; height?: number; format: (v: number) => string;
}) {
  const W = 420, padL = 8, padB = 20, padT = 8, H = height;
  const max = Math.max(1, ...data.flatMap(d => d.values));
  const slot = (W - padL) / data.length, bw = Math.min(16, slot / (data[0]?.values.length + 1 || 3));
  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 340 }} role="img" aria-label="نمودار ستونی گروهی">
        <line x1={padL} x2={W} y1={H - padB} y2={H - padB} stroke="var(--border)" />
        {data.map((d, i) => (
          <g key={i}>
            {d.values.map((v, k) => {
              const h = (H - padT - padB) * v / max, x = padL + i * slot + slot / 2 - (d.values.length * bw) / 2 + k * bw;
              return <rect key={k} x={x} y={H - padB - h} width={bw - 2} height={Math.max(h, v > 0 ? 1 : 0)} rx={3} fill={colors[k]}><title>{format(v)}</title></rect>;
            })}
            <text x={padL + i * slot + slot / 2} y={H - 5} textAnchor="middle" fontSize="9" fill="var(--muted)">{d.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function HBars({ rows, empty = 'داده‌ای نیست', max: fixedMax }: { max?: number; rows: { key: string; label: string; value: number; text: string; color?: string; sub?: string }[]; empty?: string }) {
  const max = fixedMax ?? Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return <div className="text-sm muted py-4 text-center">{empty}</div>;
  return (
    <ul className="space-y-2.5">
      {rows.map(r => (
        <li key={r.key}>
          <div className="flex justify-between text-xs mb-1 gap-2"><span className="truncate">{r.label}{r.sub && <span className="muted"> · {r.sub}</span>}</span><span className="muted shrink-0 tabular-nums">{r.text}</span></div>
          <div className="progress"><i style={{ width: `${Math.max(2, 100 * r.value / max)}%`, background: r.color }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-[11px] muted">بدون مقایسه</span>;
  if (value === 0) return <span className="text-[11px] muted">مثل دورهٔ قبل</span>;
  const good = invert ? value < 0 : value > 0;
  return <span className="text-[11px]" style={{ color: good ? '#34d399' : '#fb7185' }}>{value > 0 ? '▲' : '▼'} {faNum(Math.abs(value))}٪ نسبت به دورهٔ قبل</span>;
}
