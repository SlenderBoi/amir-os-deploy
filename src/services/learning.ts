import type { LearningTrack } from '../types';
import { localISO } from './dates';
import { addDays } from './srs';

export function minutesByDate(tracks: LearningTrack[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const log of tracks.flatMap(t => t.logs)) out[log.date] = (out[log.date] ?? 0) + log.minutes;
  return out;
}

/** The current streak is not broken until a whole day passes with no study: if today is empty it counts from yesterday. */
export function studyStreak(byDate: Record<string, number>, today: string = localISO()): { current: number; longest: number } {
  let current = 0;
  for (let i = 0; i < 3650; i++) {
    if (byDate[addDays(today, -i)]) current++;
    else if (i > 0) break;
  }
  const days = Object.keys(byDate).filter(d => byDate[d] > 0).sort();
  let longest = 0, run = 0;
  days.forEach((d, i) => { run = i > 0 && addDays(days[i - 1], 1) === d ? run + 1 : 1; longest = Math.max(longest, run); });
  return { current, longest };
}

export const minutesInLastDays = (byDate: Record<string, number>, days: number, today: string = localISO()): number =>
  Array.from({ length: days }, (_, i) => byDate[addDays(today, -i)] ?? 0).reduce((a, b) => a + b, 0);

/** Exports a track as Markdown (oldest first) so notes can be moved into Obsidian, Notion, etc. */
export function trackMarkdown(track: LearningTrack): string {
  const out = [`# ${track.title}`, ''];
  if (track.description) out.push(`> ${track.description}`, '');
  const logs = [...track.logs].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  for (const l of logs) {
    out.push(`## ${l.date} — ${l.topic} (${l.minutes} دقیقه)`, '');
    if (l.notes) out.push(l.notes, '');
    if (l.keyPoints.length) out.push('**نکات کلیدی**', ...l.keyPoints.map(k => `- ${k}`), '');
    if (l.ideas.length) out.push('**ایده‌ها**', ...l.ideas.map(k => `- ${k}`), '');
    if (l.resource) out.push(`منبع: ${l.resource}`, '');
  }
  return out.join('\n');
}
