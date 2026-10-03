import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { useStore, id } from '../store';
import { parseQuickTask, toTask } from '../services/quickTask';

/** One row in the palette: either a navigation shortcut or a search hit. */
export interface PaletteItem {
  key: string;
  title: string;
  kind: string;
  page: string;
  hint?: string;
  /** Optional side effect (quick-create). Runs before navigation. */
  run?: () => void;
}

import { snippet } from '../services/journal';
import { formatJalali } from '../services/jalali';
const PAGES: [string, string][] = [
  ['dashboard', 'امروز'], ['tasks', 'کارها'], ['projects', 'پروژه‌ها'], ['calendar', 'تقویم'],
  ['finance', 'مالی'], ['health', 'سلامت'], ['learning', 'یادگیری'], ['wishlist', 'ویش‌لیست'],
  ['notes', 'ایده‌ها و یادداشت‌ها'], ['journal', 'ثبت روزانه'], ['insights', 'آمار و فعالیت'], ['pet', 'نُکس · مأموریت و دستاورد'], ['automation', 'اتوماسیون'], ['review', 'مرور هفتگی'], ['settings', 'تنظیمات'],
];

/** Normalises Arabic/Persian letter variants and digits so "ي" matches "ی" and "۱" matches "1". */
export function normalize(text: string): string {
  return text
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase();
}

export default function CommandPalette({ go, close }: { go: (page: string) => void; close: () => void }) {
  const { data, setData } = useStore();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<PaletteItem[]>(() => {
    const needle = normalize(q.trim());
    const command = q.trimStart();
    if (command.startsWith('+') || command.startsWith('＋')) {
      const parsed = parseQuickTask(command.slice(1));
      return parsed.title ? [{ key: 'create-task', kind: 'کار جدید', page: 'tasks', title: parsed.title, hint: [parsed.due, parsed.estimate && `${parsed.estimate}m`, parsed.subtasks.length && `${parsed.subtasks.length}↳`].filter(Boolean).join(' · ') || 'Enter = ساخت', run: () => setData(d => ({ ...d, tasks: [toTask(parsed), ...d.tasks] })) }] : [];
    }
    if (command.startsWith('*')) {
      const text = command.slice(1).trim();
      const now = new Date().toISOString();
      return text ? [{ key: 'create-idea', kind: 'ایدهٔ جدید', page: 'notes', title: text, hint: 'Enter = ذخیره', run: () => setData(d => ({ ...d, notes: [{ id: id(), title: text, body: '', category: 'ایده', tags: [], pinned: false, createdAt: now, updatedAt: now }, ...d.notes] })) }] : [];
    }
    const company = (id?: string) => data.companies.find(c => c.id === id)?.name;
    const all: PaletteItem[] = [
      ...PAGES.map(([page, title]) => ({ key: `nav-${page}`, title, kind: 'برو به', page })),
      ...data.tasks.filter(t => t.status !== 'archived').map(t => ({ key: `t-${t.id}`, title: t.title, kind: 'کار', page: 'tasks', hint: t.due, extra: t.description + t.tags.join(' ') })),
      ...data.projects.map(p => ({ key: `p-${p.id}`, title: p.name, kind: 'پروژه', page: 'projects', hint: company(p.companyId), extra: p.description })),
      ...data.companies.map(c => ({ key: `c-${c.id}`, title: c.name, kind: 'شرکت', page: 'projects', extra: '' })),
      ...data.transactions.map(x => ({ key: `x-${x.id}`, title: x.title, kind: 'تراکنش', page: 'finance', hint: x.date, extra: x.category + x.notes })),
      ...data.notes.map(n => ({ key: `n-${n.id}`, title: n.title || 'بدون عنوان', kind: n.category, page: 'notes', extra: n.body + n.tags.join(' ') })),
      ...data.events.map(e => ({ key: `e-${e.id}`, title: e.title, kind: 'رویداد', page: 'calendar', hint: e.date, extra: '' })),
      ...data.habits.map(h => ({ key: `h-${h.id}`, title: h.title, kind: 'عادت', page: 'health', extra: '' })),
      ...data.learning.map(l => ({ key: `l-${l.id}`, title: l.title, kind: 'یادگیری', page: 'learning', extra: l.description + l.tags.join(' ') + l.logs.map(g => g.topic + g.notes).join(' ') })),
      ...data.journal.map(j => ({ key: `j-${j.id}`, title: snippet(j, 60) || 'ثبت روزانه', kind: 'ثبت روزانه', page: 'journal', hint: formatJalali(j.date), extra: [j.wins, j.improve, j.gratitude, j.note, ...j.intentions.map(i => i.text)].join(' ') })),
      ...data.wishes.map(w => ({ key: `w-${w.id}`, title: w.title, kind: 'ویش‌لیست', page: 'wishlist', extra: w.notes + w.tags.join(' ') })),
    ];
    if (!needle) return all.filter(i => i.key.startsWith('nav-'));
    return all
      .filter(i => normalize(`${i.title} ${(i as { extra?: string }).extra ?? ''}`).includes(needle))
      .sort((a, b) => Number(normalize(b.title).startsWith(needle)) - Number(normalize(a.title).startsWith(needle)))
      .slice(0, 30);
  }, [q, data]);

  const selectedIndex = Math.min(active, Math.max(items.length - 1, 0));
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const choose = (item?: PaletteItem) => { if (item) { item.run?.(); go(item.page); close(); } };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(selectedIndex + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(selectedIndex - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[selectedIndex]); }
    else if (e.key === 'Escape') close();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/70 backdrop-blur-sm p-3 pt-[10vh]"
      onMouseDown={e => e.target === e.currentTarget && close()} role="dialog" aria-modal="true" aria-label="جستجوی سراسری">
      <div className="card w-full max-w-xl overflow-hidden shadow-2xl" style={{ boxShadow: '0 0 60px var(--glow)' }}>
        <div className="flex items-center gap-3 border-b px-4" style={{ borderColor: 'var(--border)' }}>
          <Search size={18} className="muted shrink-0" />
          <input autoFocus value={q} onChange={e => { setQ(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
            className="w-full bg-transparent py-4 outline-none text-base" style={{ color: 'var(--text)' }}
            placeholder="جستجو… یا با + کار و با * ایده بساز" aria-label="عبارت جستجو" />
          <kbd className="chip shrink-0">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[55vh] overflow-auto scrollbar p-2" role="listbox">
          {items.map((item, i) => (
            <button key={item.key} data-index={i} role="option" aria-selected={i === selectedIndex}
              onMouseMove={() => setActive(i)} onClick={() => choose(item)}
              className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-right"
              style={i === selectedIndex ? { background: 'var(--panel2)', outline: '1px solid var(--accent)' } : undefined}>
              <span className="truncate">{item.title}</span>
              <span className="flex items-center gap-2 shrink-0">
                {item.hint && <span className="text-xs muted" dir="ltr">{item.hint}</span>}
                <span className="chip">{item.kind}</span>
                {i === selectedIndex && <CornerDownLeft size={14} className="accent" />}
              </span>
            </button>
          ))}
          {!items.length && <div className="p-8 text-center muted text-sm">نتیجه‌ای پیدا نشد.</div>}
        </div>
        <div className="flex gap-4 border-t px-4 py-2 text-[11px] muted" style={{ borderColor: 'var(--border)' }}>
          <span>↑↓ حرکت</span><span>Enter انتخاب</span><span>+ کار جدید</span><span>* ایده</span><span>Ctrl+K باز و بسته</span>
        </div>
      </div>
    </div>
  );
}
