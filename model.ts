/**
 * A REAL, lightweight prediction model that trains in the browser.
 *
 * Log-linear regression (ordinary least squares with a tiny ridge term):
 *   log(orders) = b0 + Σ hour effects + Σ weekday effects + b·promo + b·event + b·eid + b·payday (+ …)
 * A multiplicative model fits restaurant demand naturally ("Eid night is ×1.75").
 *
 * Everything here is driven by the participant's decisions:
 *  - which cleaned dataset (station 1),
 *  - which features (station 3),
 *  - which training configuration (station 4).
 * All metrics shown in the UI are computed here on the synthetic DataBite data.
 */
import { DATA, FUTURE_WEEK, HOURS, HourRecord, RAMADAN_TEST, RAMADAN_TRAIN, mean } from './dataset';

export type FeatureId = 'hour' | 'weekday' | 'promo' | 'event' | 'eid' | 'payday' | 'temperature' | 'staff' | 'orderId' | 'ramadan';
export const MODEL_FEATURES: FeatureId[] = ['hour', 'weekday', 'promo', 'event', 'eid', 'payday', 'temperature', 'staff', 'orderId', 'ramadan'];
/** Features we can actually know a week ahead. */
export const KNOWN_AHEAD: FeatureId[] = ['hour', 'weekday', 'promo', 'event', 'eid', 'payday', 'ramadan'];
export const BEST_FEATURES: FeatureId[] = ['hour', 'weekday', 'promo', 'event', 'eid', 'payday'];

export interface Inputs {
  hour: number;
  weekday: number;
  promo: boolean;
  event: boolean;
  eid?: boolean;
  payday?: boolean;
  ramadan?: boolean;
  temperature?: number;
  staff?: number;
  day?: number;
}

/** Average staff on shift — all we can plug in for "staff" when predicting next week (it isn't known yet). */
export const AVG_STAFF = Math.round(mean(DATA.map((r) => r.staff)) * 10) / 10;

function featureVector(x: Inputs, features: FeatureId[]): number[] {
  const v = [1];
  if (features.includes('hour')) HOURS.slice(1).forEach((h) => v.push(x.hour === h ? 1 : 0));
  if (features.includes('weekday')) for (let d = 1; d < 7; d++) v.push(x.weekday === d ? 1 : 0);
  if (features.includes('promo')) v.push(x.promo ? 1 : 0);
  if (features.includes('event')) v.push(x.event ? 1 : 0);
  if (features.includes('eid')) v.push(x.eid ? 1 : 0);
  if (features.includes('payday')) v.push(x.payday ? 1 : 0);
  if (features.includes('temperature')) v.push(((x.temperature ?? 32) - 32) / 5);
  if (features.includes('staff')) v.push(((x.staff ?? AVG_STAFF) - 4) / 2);
  if (features.includes('orderId')) v.push(((x.day ?? 14) * 12 + (x.hour - 12)) / 336);
  // Ramadan reshapes the whole day → one Ramadan effect per hour
  if (features.includes('ramadan')) HOURS.forEach((h) => v.push(x.ramadan && x.hour === h ? 1 : 0));
  return v;
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

export interface TrainedModel {
  features: FeatureId[];
  weights: number[];
  predict: (x: Inputs) => number;
}

export function train(rows: HourRecord[], features: FeatureId[]): TrainedModel {
  const usable = features.filter((f) => MODEL_FEATURES.includes(f));
  const X = rows.map((r) => featureVector(r, usable));
  const y = rows.map((r) => Math.log(Math.max(1, r.orders)));
  const p = X[0].length;
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  for (let a = 1; a < p; a++) XtX[a][a] += 0.01; // tiny ridge (also handles a feature never seen, e.g. Eid in weeks 1–2)
  const w = solve(XtX, Xty);
  const resid = X.map((xi, i) => y[i] - xi.reduce((s, v, k) => s + v * w[k], 0));
  const smear = mean(resid.map((e) => Math.exp(e)));
  return {
    features: usable,
    weights: w,
    predict: (x) => Math.exp(featureVector(x, usable).reduce((s, v, k) => s + v * w[k], 0)) * smear,
  };
}

// ---- training configurations (station 4) ---------------------------------
export type TrainConfig = 'honest' | 'small' | 'same';
export const CONFIG_INFO: Record<TrainConfig, { ar: string; train: string; test: string }> = {
  honest: { ar: 'تدريب على الأسابيع 1–3 واختبار على الأسبوع 4', train: 'weeks 1-3', test: 'week 4' },
  small: { ar: 'تدريب على الأسبوعين 1–2 فقط واختبار على 3–4', train: 'weeks 1-2', test: 'weeks 3-4' },
  same: { ar: 'نموذج «يحفظ» الجدول، ويُقيَّم على نفس البيانات اللي حفظها', train: 'weeks 1-4 (memorised)', test: 'weeks 1-4 (same rows)' },
};
export function splitFor(rows: HourRecord[], cfg: TrainConfig) {
  if (cfg === 'small') return { train: rows.filter((r) => r.week <= 2), test: rows.filter((r) => r.week >= 3) };
  if (cfg === 'same') return { train: rows, test: rows };
  return { train: rows.filter((r) => r.week <= 3), test: rows.filter((r) => r.week === 4) };
}

/** What we can feed the model when predicting a future hour (no peeking at the future). */
export const realInputs = (r: Inputs): Inputs => ({ ...r, staff: AVG_STAFF });

export interface Evaluation {
  /** what the participant's own evaluation reports */
  mae: number;
  within5: number;
  mape: number;
  baselineMae: number; // "always predict the overall average"
  hourAvgMae: number; // "predict the average of that hour"
  pairs: { r: HourRecord; pred: number }[];
  /** what really happens next week (week 5, never seen by anyone): real future inputs vs. the true world */
  realMae: number;
  trainRows: number;
  testRows: number;
}

export function evaluate(model: TrainedModel, test: HourRecord[], trainRows: HourRecord[]): Evaluation {
  const pairs = test.map((r) => ({ r, pred: model.predict({ ...r, day: r.day }) }));
  const errs = pairs.map((p) => Math.abs(p.pred - p.r.orders));
  const overall = mean(trainRows.map((r) => r.orders));
  const hourAvg = (h: number) => mean(trainRows.filter((r) => r.hour === h).map((r) => r.orders));

  return {
    mae: mean(errs),
    within5: errs.filter((e) => e <= 5).length / errs.length,
    mape: mean(pairs.map((p) => Math.abs(p.pred - p.r.orders) / Math.max(1, p.r.orders))),
    baselineMae: mean(test.map((r) => Math.abs(overall - r.orders))),
    hourAvgMae: mean(test.map((r) => Math.abs(hourAvg(r.hour) - r.orders))),
    pairs,
    realMae: mean(FUTURE_WEEK.map((r) => Math.abs(model.predict(realInputs(r)) - r.orders))),
    trainRows: trainRows.length,
    testRows: test.length,
  };
}

export type CrowdLevel = { key: 'calm' | 'moderate' | 'busy' | 'peak'; label: string; color: string };
export function crowdLevel(orders: number): CrowdLevel {
  if (orders < 18) return { key: 'calm', label: 'هادئ', color: '#10B981' };
  if (orders < 30) return { key: 'moderate', label: 'متوسط', color: '#F59E0B' };
  if (orders < 45) return { key: 'busy', label: 'مزدحم', color: '#F97316' };
  return { key: 'peak', label: 'ذروة شديدة', color: '#E11D48' };
}

/** Model + evaluation for one combination of upstream decisions (cached). */
export interface ModelRun {
  model: TrainedModel;
  ev: Evaluation;
  config: TrainConfig;
}
/**
 * The classic overfitting trap: a "model" that memorises every training row.
 * On rows it has seen it is perfect; for a new day it can only copy the same weekday & hour from the last week it saw.
 */
export function memorize(rows: HourRecord[]): TrainedModel {
  const seen = new Map(rows.map((r) => [`${r.day}-${r.hour}`, r.orders]));
  const lastWeek = Math.max(...rows.map((r) => r.week));
  const fallback = new Map(rows.filter((r) => r.week === lastWeek).map((r) => [`${r.weekday}-${r.hour}`, r.orders]));
  return {
    features: [],
    weights: [],
    predict: (x) => seen.get(`${x.day}-${x.hour}`) ?? fallback.get(`${x.weekday}-${x.hour}`) ?? 20,
  };
}

const runCache = new Map<string, ModelRun>();
export function runModel(rows: HourRecord[], rowsKey: string, features: FeatureId[], config: TrainConfig): ModelRun {
  const key = `${rowsKey}|${[...features].sort().join(',')}|${config}`;
  const hit = runCache.get(key);
  if (hit) return hit;
  const { train: tr, test } = splitFor(rows, config);
  const model = config === 'same' ? memorize(tr) : train(tr, features);
  const run = { model, ev: evaluate(model, test, tr), config };
  runCache.set(key, run);
  return run;
}

// ---- default model (used before the participant's own decisions exist) ----
export const DEFAULT_FEATURES: FeatureId[] = BEST_FEATURES;
export const TRAIN_ROWS = DATA.filter((r) => r.week <= 3);
export const TEST_ROWS = DATA.filter((r) => r.week === 4);
export function modelFor(features: FeatureId[]): TrainedModel {
  return runModel(DATA, 'sameSlot', features, 'honest').model;
}

/** Final challenge: retrain the participant's model with the first Ramadan days added, and a Ramadan feature. */
export function ramadanModels(before: TrainedModel, rows: HourRecord[] = DATA) {
  const feats = before.features.filter((f) => f !== 'ramadan' && f !== 'staff');
  const after = train([...rows, ...RAMADAN_TRAIN], [...feats, 'ramadan']);
  const mae = (m: TrainedModel, rs: HourRecord[]) => mean(rs.map((r) => Math.abs(m.predict(realInputs(r)) - r.orders)));
  return { before, after, maeBefore: mae(before, RAMADAN_TEST), maeAfter: mae(after, RAMADAN_TEST), maeNormal: evaluate(before, TEST_ROWS, TRAIN_ROWS).realMae };
}
