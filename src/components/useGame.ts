import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { gameState } from '../services/game';

/** Game state for the current data; re-evaluated every minute so a new day / the evening mood roll over by themselves. */
export function useGame() {
  const { data } = useStore();
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => { const t = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 60_000); return () => clearInterval(t); }, []);
  const g = useMemo(() => gameState(data, new Date()), [data, minute]);
  return { data, g };
}

/** Glow colour of the evolution stage (purely cosmetic). */
export function stageGlow(level: number): string {
  if (level >= 15) return '#f43f5e';
  if (level >= 10) return '#f59e0b';
  if (level >= 6) return '#e879f9';
  if (level >= 3) return '#22d3ee';
  return '#8b5cf6';
}
