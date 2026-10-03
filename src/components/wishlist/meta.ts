import { BookOpen, Clapperboard, Gamepad2, GraduationCap, Sparkles, ShoppingBag, Tv, Wand2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WishCategory, WishStatus } from '../../types';

export const CATEGORIES: { id: WishCategory; label: string; icon: LucideIcon; from: string; to: string }[] = [
  { id: 'purchase', label: 'خرید', icon: ShoppingBag, from: '#065f46', to: '#0f766e' },
  { id: 'movie', label: 'فیلم', icon: Clapperboard, from: '#9f1239', to: '#6b21a8' },
  { id: 'series', label: 'سریال', icon: Tv, from: '#3730a3', to: '#6d28d9' },
  { id: 'anime', label: 'انیمه', icon: Wand2, from: '#a21caf', to: '#be185d' },
  { id: 'course', label: 'دوره', icon: GraduationCap, from: '#075985', to: '#1d4ed8' },
  { id: 'book', label: 'کتاب', icon: BookOpen, from: '#92400e', to: '#b45309' },
  { id: 'game', label: 'بازی', icon: Gamepad2, from: '#166534', to: '#4d7c0f' },
  { id: 'experience', label: 'تجربه', icon: Sparkles, from: '#5b21b6', to: '#7c3aed' },
  { id: 'other', label: 'سایر', icon: Sparkles, from: '#374151', to: '#4b5563' },
];

export const categoryOf = (id: WishCategory) => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export const STATUS_FA: Record<WishStatus, string> = { wanted: 'می‌خواهم', planned: 'برنامه‌ریزی‌شده', doing: 'در حال انجام', done: 'تمام‌شده', dropped: 'کنار گذاشته‌شده' };
export const PRIORITY_FA = { low: 'کم', medium: 'متوسط', high: 'زیاد', urgent: 'فوری' } as const;
