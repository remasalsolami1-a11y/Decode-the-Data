import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import type { FeatureId } from './model';

export type StationId = 'de' | 'da' | 'ds' | 'ml' | 'bi' | 'gov';
export type ScreenId = 'landing' | 'mission' | 'map' | StationId | 'system' | 'ramadan' | 'career' | 'done' | 'mydata';
export const SCREEN_ORDER: ScreenId[] = ['landing', 'mission', 'map', 'de', 'da', 'ds', 'ml', 'bi', 'gov', 'system', 'ramadan', 'career', 'done'];
export type Mode = 'workshop' | 'full';
export const STATION_ORDER: StationId[] = ['de', 'da', 'ds', 'ml', 'bi', 'gov'];

/** Outputs each station hands to the next ones (the "shared project"). */
export interface Outputs {
  de?: { missingStrategy: 'sameSlot' | 'overall'; removed: number };
  da?: { peakHour: number; busiestDay: number; conclusion: string };
  ds?: { features: FeatureId[]; approach: 'combined' };
  ml?: { features: FeatureId[]; trained: true };
  bi?: { kpis: string[]; decision: string };
  gov?: { sensitive: string[]; approved: true };
}

export interface AppState {
  v: 3;
  screen: ScreenId;
  /** workshop = short version (core steps only); full = everything */
  mode: Mode;
  /** final Ramadan "data drift" challenge */
  boss: { step: number; peaks: number[]; done?: boolean; skipped?: boolean };
  /** when the current screen was opened (presenter timer) */
  screenAt?: number;
  /** stations where the participant opened «Explore further» */
  explored?: string[];
  /** achievements already announced */
  awarded?: string[];
  completed: Partial<Record<StationId, boolean>>;
  /** per-station step and local choices so a refresh resumes mid-station */
  station: Partial<Record<StationId, Record<string, unknown>>>;
  outputs: Outputs;
  career: { ratings: Record<string, number>; picks: Record<string, string>; done?: boolean };
  name: string;
  presenter: boolean;
  startedAt?: number;
  finishedAt?: number;
}

const initial: AppState = {
  v: 3,
  screen: 'landing',
  mode: 'full',
  boss: { step: 0, peaks: [] },
  completed: {},
  station: {},
  outputs: {},
  career: { ratings: {}, picks: {} },
  name: '',
  presenter: false,
};

type Action =
  | { type: 'go'; screen: ScreenId }
  | { type: 'patchStation'; id: StationId; patch: Record<string, unknown> }
  | { type: 'complete'; id: StationId; output: Outputs[StationId] }
  | { type: 'career'; patch: Partial<AppState['career']> }
  | { type: 'set'; patch: Partial<AppState> }
  | { type: 'resetStation'; id: StationId }
  | { type: 'reset' };

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'go':
      return { ...s, screen: a.screen, screenAt: a.screen === s.screen ? s.screenAt : Date.now(), startedAt: s.startedAt ?? (a.screen !== 'landing' ? Date.now() : undefined) };
    case 'patchStation':
      return { ...s, station: { ...s.station, [a.id]: { ...(s.station[a.id] ?? {}), ...a.patch } } };
    case 'complete':
      return { ...s, completed: { ...s.completed, [a.id]: true }, outputs: { ...s.outputs, [a.id]: a.output } };
    case 'career':
      return { ...s, career: { ...s.career, ...a.patch } };
    case 'set':
      return { ...s, ...a.patch };
    case 'resetStation':
      return { ...s, station: { ...s.station, [a.id]: {} } };
    case 'reset':
      return { ...initial, presenter: s.presenter, mode: s.mode };
  }
}

const KEY = 'decode-the-data:v3';
const OLD_KEYS = ['decode-the-data:v2'];

/**
 * Safe migration of saved progress between versions.
 * v2 → v3: decisions now drive the project. Keep progress, mark already-validated feature sets,
 * and drop the old fixed BI decision (the participant re-plans staffing with real consequences).
 */
export function migrate(parsed: Record<string, unknown> | null): AppState {
  if (!parsed || typeof parsed !== 'object') return initial;
  if (parsed.v === 3) return { ...initial, ...(parsed as Partial<AppState>) };
  if (parsed.v === 2) {
    const p = parsed as unknown as AppState & { station: Record<string, Record<string, unknown>> };
    const station = { ...(p.station ?? {}) } as Record<string, Record<string, unknown>>;
    if (station.ds?.featureOk) station.ds = { ...station.ds, featuresDone: true };
    if (station.bi) {
      const bi = { ...station.bi };
      delete bi.decision;
      if (typeof bi.step === 'number' && bi.step > 3) bi.step = 3;
      station.bi = bi;
    }
    if (station.gov && typeof station.gov.step === 'number' && station.gov.step > 4) station.gov = { ...station.gov, step: 4 };
    return { ...initial, ...p, v: 3, station: station as AppState['station'], completed: { ...p.completed, bi: false, gov: false } };
  }
  return initial;
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
    for (const k of OLD_KEYS) {
      const old = localStorage.getItem(k);
      if (old) {
        const m = migrate(JSON.parse(old));
        localStorage.removeItem(k);
        return m;
      }
    }
    return initial;
  } catch {
    return initial;
  }
}

interface Ctx {
  state: AppState;
  dispatch: (a: Action) => void;
  go: (s: ScreenId) => void;
}
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — the experience still works, it just won't resume */
    }
  }, [state]);
  const go = useCallback((screen: ScreenId) => {
    dispatch({ type: 'go', screen });
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, []);
  const value = useMemo(() => ({ state, dispatch, go }), [state, go]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c;
}

/** Persistent local state for one station (step number + choices). */
export function useStationState<T extends Record<string, unknown>>(id: StationId, defaults: T) {
  const { state, dispatch } = useStore();
  const current = { ...defaults, ...(state.station[id] as Partial<T> | undefined) } as T;
  const set = useCallback((patch: Partial<T>) => dispatch({ type: 'patchStation', id, patch }), [dispatch, id]);
  return [current, set] as const;
}

export const isFast = (state: AppState) => state.mode === 'workshop';

export function isUnlocked(state: AppState, id: StationId) {
  if (state.presenter) return true;
  const i = STATION_ORDER.indexOf(id);
  return i === 0 || !!state.completed[STATION_ORDER[i - 1]] || !!state.completed[id];
}

/** the participant's first name (for characters to address them), or '' */
export const firstName = (state: Pick<AppState, 'name'>) => (state.name ?? '').trim().split(/\s+/)[0]?.slice(0, 20) ?? '';
