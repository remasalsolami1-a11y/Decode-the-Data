/**
 * DataBite (Jeddah corniche) — one shared, fictional dataset used by every station.
 *
 * 4 weeks (18 May – 14 Jun 2025, includes Eid al-Adha and payday on the 27th)
 * × 7 days × 12 opening hours (12:00–23:00) = 336 hourly records.
 * Plus a separate Ramadan week (Feb 2026) used only by the final "data drift" challenge.
 * Values are generated deterministically (seeded), so every visitor sees the
 * exact same numbers and every chart, table and prediction stays consistent.
 *
 * The data is EDUCATIONAL and SYNTHETIC — it does not describe a real restaurant.
 */

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;
export const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] as const;
export const START_DATE = new Date(Date.UTC(2025, 4, 18)); // Sunday 18 May 2025
export const AVG_TICKET_SAR = 48;
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const round1 = (x: number) => Math.round(x * 10) / 10;
export const ORDERS_PER_STAFF = 8; // staffing rule used by BI & ML: one team member per 8 orders/hour

export interface HourRecord {
  id: string; // e.g. "R-0125"
  day: number; // 0..27
  week: number; // 1..4
  date: string; // ISO yyyy-mm-dd
  weekday: number; // 0 = Sunday … 6 = Saturday
  hour: number; // 12..23
  promo: boolean; // a promotion was running that day
  event: boolean; // a nearby event on the corniche that evening
  eid: boolean; // Eid al-Adha night / Eid day evening
  payday: boolean; // the 27th — government salaries are paid
  ramadan?: boolean; // only in the Ramadan drift week
  temperature: number; // °C
  dinein: number; // orders from the in-restaurant POS
  delivery: number; // orders from the delivery app
  orders: number; // dinein + delivery  (the target)
  staff: number; // staff on shift (decided by the manager — NOT a cause of demand)
  imputed?: boolean; // true when a missing value was filled during cleaning
}

// ---- deterministic pseudo random --------------------------------------
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR_BASE: Record<number, number> = {
  12: 17, 13: 29, 14: 25, 15: 14, 16: 10, 17: 12, 18: 18, 19: 27, 20: 36, 21: 40, 22: 32, 23: 19,
};
const DAY_FACTOR = [0.88, 0.84, 0.9, 1.0, 1.32, 1.24, 1.1];
const DELIVERY_SHARE: Record<number, number> = {
  12: 0.3, 13: 0.32, 14: 0.35, 15: 0.38, 16: 0.4, 17: 0.4, 18: 0.38, 19: 0.38, 20: 0.4, 21: 0.43, 22: 0.48, 23: 0.55,
};

/** Days with a promotion campaign (spread across different weekdays). */
export const PROMO_DAYS = new Set([3, 8, 16, 21, 24]);
/** Evenings with a nearby event on Jeddah corniche (19:00–23:00). */
export const EVENT_DAYS = new Set([6, 12, 26]);
export const EVENT_HOURS = new Set([19, 20, 21, 22, 23]);
/** Day 9 = Tue 27 May 2025: salaries land. */
export const PAYDAY_DAY = 9;
/** Day 18 = Thu 5 Jun 2025: the night before Eid al-Adha. Day 19 = Fri 6 Jun: Eid day. */
export const EID_NIGHT = 18;
export const EID_DAY = 19;
export const isEid = (day: number, hour: number) => (day === EID_NIGHT && hour >= 18) || (day === EID_DAY && hour >= 17);
export const SPECIAL_DAYS: Record<number, string> = {
  [EID_NIGHT]: 'ليلة عيد الأضحى',
  [EID_DAY]: 'يوم العيد',
  [PAYDAY_DAY]: 'يوم 27 — نزل الراتب',
  6: 'فعالية على الكورنيش',
  12: 'فعالية على الكورنيش',
  26: 'فعالية على الكورنيش',
};

function isoDate(day: number) {
  const d = new Date(START_DATE.getTime() + day * 86400000);
  return d.toISOString().slice(0, 10);
}

function generate(): HourRecord[] {
  const rand = mulberry32(20261116);
  const rows: HourRecord[] = [];
  const dayTemp: number[] = [];
  for (let day = 0; day < 28; day++) dayTemp.push(27 + Math.round(rand() * 9));

  for (let day = 0; day < 28; day++) {
    const weekday = day % 7;
    const promo = PROMO_DAYS.has(day);
    for (const hour of HOURS) {
      const event = EVENT_DAYS.has(day) && EVENT_HOURS.has(hour);
      const eid = isEid(day, hour);
      const payday = day === PAYDAY_DAY;
      const noise = 0.84 + rand() * 0.32;
      const eidF = !eid ? 1 : day === EID_NIGHT ? 1.75 : 1.45;
      const expected = HOUR_BASE[hour] * DAY_FACTOR[weekday] * (promo ? 1.22 : 1) * (event ? 1.4 : 1) * eidF * (payday ? 1.45 : 1);
      const orders = Math.max(2, Math.round(expected * noise));
      const delivery = Math.round(orders * DELIVERY_SHARE[hour]);
      const dinein = orders - delivery;
      // afternoon slightly hotter; temperature has no real effect on demand
      const temperature = dayTemp[day] + (hour >= 13 && hour <= 16 ? 3 : hour >= 21 ? -3 : 0) + Math.round(rand() * 2 - 1);
      // the manager staffs up when they *expect* it to be busy → strong but non-causal correlation
      const staff = Math.max(2, Math.round(orders / 9 + 1 + (rand() - 0.5)));
      rows.push({
        id: '',
        day,
        week: Math.floor(day / 7) + 1,
        date: isoDate(day),
        weekday,
        hour,
        promo,
        event,
        eid,
        payday,
        temperature,
        dinein,
        delivery,
        orders,
        staff,
      });
    }
  }
  rows.forEach((r, i) => (r.id = `R-${String(i + 1).padStart(4, '0')}`));
  return rows;
}

/** The "real world" (what actually happened). Only the simulation knows it — used to judge decisions honestly. */
export const TRUTH = generate();
const RAW_TRUTH = TRUTH;

/** Week 5 (15–21 June 2025): the "next week" nobody has seen. Used only to measure how a model really performs. */
export const FUTURE_WEEK: HourRecord[] = (() => {
  const rand = mulberry32(20250615);
  const rows: HourRecord[] = [];
  for (let day = 28; day < 35; day++) {
    const weekday = day % 7;
    for (const hour of HOURS) {
      const orders = Math.max(2, Math.round(HOUR_BASE[hour] * DAY_FACTOR[weekday] * (0.84 + rand() * 0.32)));
      const delivery = Math.round(orders * DELIVERY_SHARE[hour]);
      rows.push({
        id: `F-${day}-${hour}`, day, week: 5, date: isoDate(day), weekday, hour, promo: false, event: false, eid: false, payday: false,
        temperature: 30, dinein: orders - delivery, delivery, orders, staff: Math.max(2, Math.round(orders / 9 + 1)),
      });
    }
  }
  return rows;
})();

/** Expected demand without random noise — the ground truth used to judge staffing decisions. */
export function trueExpected(x: { weekday: number; hour: number; promo?: boolean; event?: boolean; eid?: boolean; eidDay?: boolean; payday?: boolean }) {
  const eidF = x.eid ? (x.eidDay ? 1.45 : 1.75) : 1;
  return HOUR_BASE[x.hour] * DAY_FACTOR[x.weekday] * (x.promo ? 1.22 : 1) * (x.event ? 1.4 : 1) * eidF * (x.payday ? 1.45 : 1);
}

// ---- data quality problems in the RAW data (fixed in station 1) ----------
/** POS outages during busy evenings → dine-in count missing for these hours. */
export const MISSING_CELLS: { day: number; hour: number }[] = [
  { day: 4, hour: 20 }, { day: 6, hour: 20 }, { day: 10, hour: 20 }, { day: 11, hour: 21 }, { day: 11, hour: 22 }, { day: 12, hour: 20 },
  { day: 13, hour: 21 }, { day: 17, hour: 21 }, { day: 25, hour: 21 }, { day: 26, hour: 21 }, { day: 26, hour: 22 }, { day: 27, hour: 20 },
];
const MISSING_KEYS = new Set(MISSING_CELLS.map((c) => `${c.day}-${c.hour}`));
export const isMissingCell = (r: { day: number; hour: number }) => MISSING_KEYS.has(`${r.day}-${r.hour}`);
/** Rows the POS re-sent twice (duplicates). */
export const DUPLICATE_COUNT = 9;
export const RAW_ROW_COUNT = 336 + DUPLICATE_COUNT;

/** The cell shown in the station-1 snapshot (Thursday week 4, 21:00). */
export const MISSING_CELL = { day: 25, hour: 21 };

export type MissingStrategy = 'sameSlot' | 'overall' | 'drop' | 'zero';
const ordinary = (r: HourRecord) => !r.eid && !r.event && !r.payday && !r.promo && !isMissingCell(r);

/** Same weekday & hour, ordinary days only (special nights would inflate the estimate), never other missing cells. */
export function imputeSameSlot(rows: HourRecord[], day: number, hour: number) {
  const weekday = day % 7;
  let peers = rows.filter((r) => r.weekday === weekday && r.hour === hour && r.day !== day && ordinary(r));
  // safety net: if no ordinary same-weekday peer exists, use any observed same-weekday hour that isn't Eid
  if (!peers.length) peers = rows.filter((r) => r.weekday === weekday && r.hour === hour && r.day !== day && !r.eid && !isMissingCell(r));
  return Math.round(mean(peers.map((r) => r.dinein)));
}
const OBSERVED_DINEIN_AVG = () => Math.round(mean(RAW_TRUTH.filter((r) => !isMissingCell(r)).map((r) => r.dinein)));

export interface CleanResult {
  rows: HourRecord[];
  strategy: MissingStrategy;
  affected: number; // missing cells touched by the decision
  removed: number; // rows lost
  duplicatesRemoved: number;
  formatsUnified: number;
}
const cleanCache = new Map<MissingStrategy, CleanResult>();
/** Station 1's pipeline applied to ALL 4 weeks, following the participant's missing-value decision. */
export function buildDataset(strategy: MissingStrategy): CleanResult {
  const hit = cleanCache.get(strategy);
  if (hit) return hit;
  const overall = OBSERVED_DINEIN_AVG();
  const rows: HourRecord[] = [];
  for (const r of RAW_TRUTH) {
    if (!isMissingCell(r)) {
      rows.push(r);
      continue;
    }
    if (strategy === 'drop') continue;
    const dinein = strategy === 'zero' ? 0 : strategy === 'overall' ? overall : imputeSameSlot(RAW_TRUTH, r.day, r.hour);
    rows.push({ ...r, dinein, orders: Math.max(1, dinein + r.delivery), imputed: true });
  }
  const res: CleanResult = { rows, strategy, affected: MISSING_CELLS.length, removed: 336 - rows.length, duplicatesRemoved: DUPLICATE_COUNT, formatsUnified: 336 };
  cleanCache.set(strategy, res);
  return res;
}

/** Default (best-practice) clean dataset — used when a station is visited before its predecessors are done. */
export const DATA: HourRecord[] = buildDataset('sameSlot').rows;

// ---- helpers used across stations --------------------------------------

/** Average orders on a normal Thursday at 21:00 (Eid night excluded) — the reference number used across the journey. */
export function thu21(rows: HourRecord[]) {
  const xs = rows.filter((r) => r.weekday === 4 && r.hour === 21 && !r.eid).map((r) => r.orders);
  return Math.round(mean(xs) * 10) / 10;
}
export function avgByHour(rows: HourRecord[]) {
  return HOURS.map((h) => ({ hour: h, value: round1(mean(rows.filter((r) => r.hour === h).map((r) => r.orders))) }));
}
export function avgByWeekdayHour(rows: HourRecord[] = DATA) {
  return WEEKDAYS.map((_, wd) => HOURS.map((h) => round1(mean(rows.filter((r) => r.weekday === wd && r.hour === h).map((r) => r.orders)))));
}
export function dailyTotals(rows: HourRecord[] = DATA) {
  const out: { day: number; date: string; weekday: number; total: number }[] = [];
  for (let d = 0; d < 28; d++) {
    const ds = rows.filter((r) => r.day === d);
    out.push({ day: d, date: ds[0].date, weekday: ds[0].weekday, total: ds.reduce((s, r) => s + r.orders, 0) });
  }
  return out;
}
export function correlation(xs: number[], ys: number[]) {
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}
export const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;
export const fmtHour12 = (h: number) => {
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:00 ${h >= 12 ? 'PM' : 'AM'}`;
};
export const hourLabelAr = (h: number) => {
  const hh = h % 12 === 0 ? 12 : h % 12;
  const part = h < 15 ? 'ظهرًا' : h < 18 ? 'عصرًا' : 'مساءً';
  return `${hh} ${part}`;
};
export const staffFor = (orders: number) => Math.max(2, Math.ceil(orders / ORDERS_PER_STAFF));

// ---- summary statistics (real, computed from DATA) ----------------------
export type Stats = ReturnType<typeof computeStats>;
const statsCache = new WeakMap<HourRecord[], ReturnType<typeof computeStatsRaw>>();
export function computeStats(rows: HourRecord[] = DATA) {
  let hit = statsCache.get(rows);
  if (!hit) {
    hit = computeStatsRaw(rows);
    statsCache.set(rows, hit);
  }
  return hit;
}
function computeStatsRaw(DATA: HourRecord[]) {
  const byHour = avgByHour(DATA);
  const peak = byHour.reduce((a, b) => (b.value > a.value ? b : a));
  const lunch = byHour.filter((x) => x.hour <= 15).reduce((a, b) => (b.value > a.value ? b : a));
  const quiet = byHour.reduce((a, b) => (b.value < a.value ? b : a));
  const totals = dailyTotals(DATA);
  const byWeekday = WEEKDAYS.map((_, wd) => round1(mean(totals.filter((t) => t.weekday === wd).map((t) => t.total))));
  const busiestDay = byWeekday.indexOf(Math.max(...byWeekday));
  const quietestDay = byWeekday.indexOf(Math.min(...byWeekday));
  const promoAvg = round1(mean(DATA.filter((r) => r.promo).map((r) => r.orders)));
  const noPromoAvg = round1(mean(DATA.filter((r) => !r.promo).map((r) => r.orders)));
  const eveningRows = DATA.filter((r) => EVENT_HOURS.has(r.hour));
  const eventAvg = round1(mean(eveningRows.filter((r) => r.event).map((r) => r.orders)));
  const noEventAvg = round1(mean(eveningRows.filter((r) => !r.event).map((r) => r.orders)));
  // fair comparison: same weekday & same hour, with vs without the factor
  const matchedLift = (flag: (r: HourRecord) => boolean) => {
    const ratios = DATA.filter(flag).map((r) => {
      const peers = DATA.filter((p) => p.weekday === r.weekday && p.hour === r.hour && !p.promo && !p.event && !p.eid && !p.payday);
      return r.orders / mean(peers.map((p) => p.orders));
    });
    return Math.round((mean(ratios) - 1) * 100);
  };
  const totalOrders = DATA.reduce((s, r) => s + r.orders, 0);
  const deliveryShare = DATA.reduce((s, r) => s + r.delivery, 0) / totalOrders;
  return {
    byHour,
    peak,
    lunch,
    quiet,
    byWeekday,
    busiestDay,
    quietestDay,
    promoAvg,
    noPromoAvg,
    promoLift: matchedLift((r) => r.promo && !r.event && !r.eid && !r.payday),
    eventAvg,
    noEventAvg,
    eventLift: matchedLift((r) => r.event && !r.promo),
    eidLift: matchedLift((r) => r.eid && !r.promo),
    paydayLift: matchedLift((r) => r.payday && !r.promo),
    totalOrders,
    avgDaily: Math.round(totalOrders / 28),
    deliveryShare,
    corrTemp: correlation(DATA.map((r) => r.temperature), DATA.map((r) => r.orders)),
    corrStaff: correlation(DATA.map((r) => r.staff), DATA.map((r) => r.orders)),
  };
}
export const STATS = computeStats(DATA);

/** How unusual each day was vs. the normal level of that weekday (used by the analyst). */
export function dayDeviation(rows: HourRecord[] = DATA) {
  const totals = dailyTotals(rows);
  return totals.map((t) => {
    const peers = totals.filter((p) => p.weekday === t.weekday && p.day !== t.day && ![EID_NIGHT, EID_DAY, PAYDAY_DAY].includes(p.day) && !PROMO_DAYS.has(p.day));
    const normal = mean(peers.map((p) => p.total));
    return { ...t, normal: Math.round(normal), pct: Math.round((t.total / normal - 1) * 100) };
  });
}
export const DAY_DEVIATION = dayDeviation(DATA);

// ---- Ramadan drift week (Feb 2026) — only for the final challenge --------
/** Ramadan 1447: an evening-shifted day. Iftar ≈ 18:00 in Jeddah, then a suhoor build-up late at night. */
const RAMADAN_HOUR: Record<number, number> = {
  12: 2, 13: 2, 14: 2, 15: 3, 16: 4, 17: 13, 18: 50, 19: 37, 20: 21, 21: 24, 22: 31, 23: 38,
};
export const RAMADAN_START = new Date(Date.UTC(2026, 1, 18)); // Wed 18 Feb 2026 (approx. 1 Ramadan 1447)
export const RAMADAN: HourRecord[] = (() => {
  const rand = mulberry32(14470901);
  const rows: HourRecord[] = [];
  for (let d = 0; d < 7; d++) {
    const weekday = (3 + d) % 7;
    const date = new Date(RAMADAN_START.getTime() + d * 86400000).toISOString().slice(0, 10);
    for (const hour of HOURS) {
      const orders = Math.max(1, Math.round(RAMADAN_HOUR[hour] * (0.92 + DAY_FACTOR[weekday] * 0.08) * (0.86 + rand() * 0.28)));
      const delivery = Math.round(orders * 0.45);
      rows.push({
        id: `RM-${d}-${hour}`, day: 100 + d, week: 99, date, weekday, hour, promo: false, event: false, eid: false, payday: false, ramadan: true,
        temperature: 26, dinein: orders - delivery, delivery, orders, staff: Math.max(2, Math.round(orders / 9 + 1)),
      });
    }
  }
  return rows;
})();
export const RAMADAN_TRAIN = RAMADAN.filter((r) => r.day < 104); // first 4 days arrive as new data
export const RAMADAN_TEST = RAMADAN.filter((r) => r.day >= 104); // the next 3 days check the retrained model

export const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const dateAr = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${AR_MONTHS[m - 1]}`;
};

// ---- raw sources shown in the Data Engineering station -----------------
// A real snapshot of Thursday, week 4 (day 25), 18:00–23:00 — before cleaning.
export const SNAPSHOT_DAY = 25;
const snap = RAW_TRUTH.filter((r) => r.day === SNAPSHOT_DAY && r.hour >= 18);

export interface RawPosRow { key: string; ts: string; hour: number; dinein: number | null; dup?: boolean; missing?: boolean }
export interface RawDelRow { key: string; time: string; day: string; hour: number; delivery: number; dup?: boolean }

export const RAW_POS: RawPosRow[] = (() => {
  const rows: RawPosRow[] = snap.map((r) => ({
    key: `p${r.hour}`,
    ts: `${r.date} ${fmtHour(r.hour)}`,
    hour: r.hour,
    dinein: r.hour === MISSING_CELL.hour ? null : r.dinein,
    missing: r.hour === MISSING_CELL.hour,
  }));
  // two duplicated rows (the POS re-sent its export)
  const d1 = { ...rows[1], key: 'p19dup', dup: true };
  const d2 = { ...rows[4], key: 'p22dup', dup: true };
  rows.splice(2, 0, d1);
  rows.splice(6, 0, d2);
  return rows;
})();

export const RAW_DELIVERY: RawDelRow[] = (() => {
  const rows: RawDelRow[] = snap.map((r) => ({
    key: `d${r.hour}`,
    time: fmtHour12(r.hour),
    day: 'Thu',
    hour: r.hour,
    delivery: r.delivery,
  }));
  const d1 = { ...rows[2], key: 'd20dup', dup: true };
  rows.splice(3, 0, d1);
  return rows;
})();

export const SNAPSHOT_CLEAN = DATA.filter((r) => r.day === SNAPSHOT_DAY && r.hour >= 18);
export const SNAPSHOT_ALTERNATIVES = (() => {
  const truthRow = RAW_TRUTH.find((r) => r.day === MISSING_CELL.day && r.hour === MISSING_CELL.hour)!;
  return {
    sameSlot: imputeSameSlot(RAW_TRUTH, MISSING_CELL.day, MISSING_CELL.hour),
    overall: OBSERVED_DINEIN_AVG(),
    delivery: truthRow.delivery,
    truth: truthRow.dinein,
  };
})();
