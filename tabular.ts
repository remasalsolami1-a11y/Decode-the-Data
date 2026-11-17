// "Try it on your own data": everything runs in the browser — the file never leaves the device.
import { unzipSync, strFromU8 } from 'fflate';

export type Cell = string | number | null;
export interface Table {
  headers: string[];
  rows: Cell[][];
}

// ---------------------------------------------------------------- parsing
const AR_DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
export const latinDigits = (s: string) => s.replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d]);

export function parseCSV(text: string): Table {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/)[0] ?? '';
  const delim = [',', ';', '\t', '،'].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const out: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cur);
      out.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    out.push(row);
  }
  return finalize(out.map((r) => r.map(cleanCell)));
}

/** skip title / blank rows above the real header (common in Arabic Excel reports) */
function finalize(grid: Cell[][]): Table {
  const rows = grid.filter((r) => r.some((c) => c != null && String(c).trim() !== ''));
  if (!rows.length) return { headers: [], rows: [] };
  const filled = (r: Cell[]) => r.filter((c) => c != null && String(c).trim() !== '').length;
  const width = Math.max(...rows.map(filled));
  let h = rows.findIndex((r, i) => i < 10 && filled(r) >= Math.max(2, width - 1) && r.every((c) => c == null || typeof c === 'string'));
  if (h < 0) h = rows.findIndex((r) => filled(r) >= Math.max(2, width - 1));
  if (h < 0) h = 0;
  const cols = Math.max(...rows.map((r) => r.length));
  const headers = Array.from({ length: cols }, (_, i) => (rows[h][i] != null ? String(rows[h][i]).trim() : '') || `عمود ${i + 1}`);
  return { headers, rows: rows.slice(h + 1).map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? null)) };
}

/** decode a text file: UTF-8, or Windows-1256 (what Arabic Excel saves as "CSV") */
export function decodeText(buf: ArrayBuffer): string {
  const utf = new TextDecoder('utf-8').decode(buf);
  if (!/\uFFFD/.test(utf)) return utf; // U+FFFD = bytes that weren't valid UTF-8
  try {
    return new TextDecoder('windows-1256').decode(buf);
  } catch {
    return utf;
  }
}

const cleanCell = (v: string | undefined): Cell => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

const colIndex = (ref: string) => {
  const letters = ref.replace(/[0-9]/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export function parseXLSX(buf: ArrayBuffer): Table {
  const files = unzipSync(new Uint8Array(buf));
  const dom = (name: string) => (files[name] ? new DOMParser().parseFromString(strFromU8(files[name]), 'application/xml') : null);
  const shared: string[] = [];
  const ss = dom('xl/sharedStrings.xml');
  if (ss) for (const si of Array.from(ss.getElementsByTagName('si'))) shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''));
  // first sheet in workbook order
  let sheetPath = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]))[0];
  const wb = dom('xl/workbook.xml');
  const rels = dom('xl/_rels/workbook.xml.rels');
  const firstSheet = wb?.getElementsByTagName('sheet')[0];
  const rid = firstSheet?.getAttribute('r:id') ?? firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  if (rid && rels) {
    const rel = Array.from(rels.getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rid);
    const target = rel?.getAttribute('Target');
    if (target) {
      const p = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      if (files[p]) sheetPath = p;
    }
  }
  const sheet = sheetPath ? dom(sheetPath) : null;
  if (!sheet) throw new Error('no-sheet');
  const grid: Cell[][] = [];
  for (const r of Array.from(sheet.getElementsByTagName('row'))) {
    const out: Cell[] = [];
    for (const c of Array.from(r.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r');
      const idx = ref ? colIndex(ref) : out.length;
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? null;
      let val: Cell = null;
      if (t === 's' && v != null) val = shared[parseInt(v)] ?? null;
      else if (t === 'inlineStr') val = Array.from(c.getElementsByTagName('t')).map((x) => x.textContent ?? '').join('');
      else if (t === 'str' || t === 'b') val = v;
      else if (v != null && v !== '') val = Number(v);
      if (typeof val === 'string') val = val.trim() === '' ? null : val.trim();
      out[idx] = val;
    }
    grid.push(out);
  }
  return finalize(grid.map((r) => Array.from({ length: r.length }, (_, i) => r[i] ?? null)));
}

// ---------------------------------------------------------------- values
export function toNumber(c: Cell): number | null {
  if (c == null) return null;
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  let s = latinDigits(c).replace(/[٬,\s]/g, '').replace('٫', '.');
  s = s.replace(/(ريال|ر\.?س|sar|sr|﷼|\$|%)/gi, '');
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const excelSerialToDate = (n: number) => new Date(Math.round((n - 25569) * 86400000));
const AR_MONTHS: [RegExp, number][] = [
  [/كانون الثاني|يناير/, 1], [/شباط|فبراير/, 2], [/آذار|اذار|مارس/, 3], [/نيسان|أبريل|ابريل/, 4], [/أيار|ايار|مايو/, 5], [/حزيران|يونيو|يونيه/, 6],
  [/تموز|يوليو|يوليه/, 7], [/آب|اب|أغسطس|اغسطس/, 8], [/أيلول|ايلول|سبتمبر/, 9], [/تشرين الأول|تشرين الاول|أكتوبر|اكتوبر/, 10], [/تشرين الثاني|نوفمبر/, 11], [/كانون الأول|كانون الاول|ديسمبر/, 12],
];
export function toDate(c: Cell): Date | null {
  if (c == null) return null;
  if (typeof c === 'number') return c > 20000 && c < 80000 && Number.isInteger(c) ? excelSerialToDate(c) : null;
  let s = latinDigits(c).trim();
  if (/[\u0600-\u06FF]/.test(s)) {
    for (const [re, n] of AR_MONTHS) if (re.test(s)) {
      const m = s.replace(/^(?:\S+\s+)?(\d{1,2})\s+.*?\s+(\d{4}).*$/, `$1/${n}/$2`);
      if (m !== s) s = m;
      break;
    }
  }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return mk(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    // Saudi convention: day first; fall back to month first when the "day" can't be a month
    return +m[2] > 12 ? mk(y, +m[1], +m[2]) : mk(y, +m[2], +m[1]);
  }
  if (/[a-z]/i.test(s)) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      return mk(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
  }
  return null;
}
const mk = (y: number, mo: number, d: number) => {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return new Date(Date.UTC(y, mo - 1, d));
};

// ---------------------------------------------------------------- columns
export interface Roles {
  date: number;
  value: number;
  category: number | null;
}
const DATE_WORDS = /(تاريخ|اليوم|يوم|شهر|date|day|time|month|وقت)/i;
/** Hijri dates (e.g. 1448/03/01) — we can't place them on the Gregorian calendar */
export const looksHijri = (t: Table) => t.rows.slice(0, 50).some((r) => r.some((c) => typeof c === 'string' && /^1[34]\d\d[-/.]\d{1,2}[-/.]\d{1,2}/.test(latinDigits(c.trim()))));
const VALUE_WORDS = /(مبلغ|قيمة|سعر|المجموع|اجمالي|إجمالي|عدد|حضور|مبيعات|كمية|amount|value|price|total|sales|count|qty|cost)/i;

export function detectRoles(t: Table): Roles | null {
  const n = t.headers.length;
  const share = (i: number, f: (c: Cell) => unknown) => {
    const vals = t.rows.map((r) => r[i]).filter((c) => c != null);
    return vals.length ? vals.filter((c) => f(c) != null).length / vals.length : 0;
  };
  // a column of plain numbers only counts as Excel dates if they sit within ~10 years of each other
  const serialOk = (i: number) => {
    const nums = t.rows.map((r) => r[i]).filter((c): c is number => typeof c === 'number');
    if (!nums.length) return true;
    return Math.max(...nums) - Math.min(...nums) < 3660;
  };
  const cols = Array.from({ length: n }, (_, i) => ({ i, d: serialOk(i) ? share(i, toDate) : 0, v: share(i, toNumber), h: t.headers[i] }));
  const dateCol = cols.filter((c) => c.d >= 0.6).sort((a, b) => Number(DATE_WORDS.test(b.h)) - Number(DATE_WORDS.test(a.h)) || b.d - a.d)[0];
  if (!dateCol) return null;
  const valueCol = cols.filter((c) => c.i !== dateCol.i && c.v >= 0.6).sort((a, b) => Number(VALUE_WORDS.test(b.h)) - Number(VALUE_WORDS.test(a.h)) || b.v - a.v)[0];
  if (!valueCol) return null;
  const catCol = cols
    .filter((c) => c.i !== dateCol.i && c.i !== valueCol.i && c.v < 0.5)
    .map((c) => ({ ...c, u: new Set(t.rows.map((r) => r[c.i]).filter((x) => x != null)).size }))
    .filter((c) => c.u >= 2 && c.u <= 15)
    .sort((a, b) => a.u - b.u)[0];
  return { date: dateCol.i, value: valueCol.i, category: catCol ? catCol.i : null };
}

// ---------------------------------------------------------------- cleaning
export interface Inspection {
  total: number;
  dupIdx: Set<number>;
  missingValueIdx: Set<number>;
  missingDateIdx: Set<number>;
}
export function inspect(t: Table, r: Roles): Inspection {
  const seen = new Set<string>();
  const dupIdx = new Set<number>();
  const missingValueIdx = new Set<number>();
  const missingDateIdx = new Set<number>();
  t.rows.forEach((row, i) => {
    const key = JSON.stringify(row.map((c) => (c == null ? '' : String(c).trim())));
    if (seen.has(key)) dupIdx.add(i);
    else seen.add(key);
    if (dupIdx.has(i)) return;
    if (toDate(row[r.date]) == null) missingDateIdx.add(i);
    if (toNumber(row[r.value]) == null) missingValueIdx.add(i);
  });
  return { total: t.rows.length, dupIdx, missingValueIdx, missingDateIdx };
}

export type FillStrategy = 'drop' | 'mean';
export interface Rec {
  date: Date;
  value: number;
  category: string | null;
  estimated: boolean;
}
export function clean(t: Table, r: Roles, ins: Inspection, fill: FillStrategy): Rec[] {
  const nums = t.rows.map((row, i) => (ins.dupIdx.has(i) ? null : toNumber(row[r.value]))).filter((x): x is number => x != null);
  const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  const out: Rec[] = [];
  t.rows.forEach((row, i) => {
    if (ins.dupIdx.has(i) || ins.missingDateIdx.has(i)) return; // no date → can't place it in time
    const v = toNumber(row[r.value]);
    if (v == null && fill === 'drop') return;
    out.push({ date: toDate(row[r.date])!, value: v ?? Math.round(mean * 100) / 100, category: r.category != null && row[r.category] != null ? String(row[r.category]) : null, estimated: v == null });
  });
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ---------------------------------------------------------------- patterns + forecast
export const WEEKDAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAY = 86400000;
const dayKey = (d: Date) => Math.floor(d.getTime() / DAY);

export interface Patterns {
  days: number;
  byWeekday: number[]; // average daily total per weekday
  byCategory: { name: string; total: number }[];
  weekly: { start: Date; total: number }[];
  forecast: number[]; // next 4 weeks
  nextMonth: number;
  trendPct: number;
}
export function patterns(recs: Rec[]): Patterns | null {
  if (!recs.length) return null;
  const daily = new Map<number, number>();
  for (const r of recs) daily.set(dayKey(r.date), (daily.get(dayKey(r.date)) ?? 0) + r.value);
  const first = Math.min(...daily.keys());
  const last = Math.max(...daily.keys());
  const days = last - first + 1;

  // weekday averages over every calendar day in range (days with no rows count as 0)
  const sum = Array(7).fill(0);
  const cnt = Array(7).fill(0);
  for (let k = first; k <= last; k++) {
    const wd = new Date(k * DAY).getUTCDay();
    sum[wd] += daily.get(k) ?? 0;
    cnt[wd]++;
  }
  const byWeekday = sum.map((s, i) => (cnt[i] ? Math.round((s / cnt[i]) * 10) / 10 : 0));

  const cats = new Map<string, number>();
  for (const r of recs) if (r.category) cats.set(r.category, (cats.get(r.category) ?? 0) + r.value);
  let byCategory = [...cats.entries()].map(([name, total]) => ({ name, total: Math.round(total) })).sort((a, b) => b.total - a.total);
  if (byCategory.length > 6) byCategory = [...byCategory.slice(0, 5), { name: 'أخرى', total: byCategory.slice(5).reduce((a, b) => a + b.total, 0) }];

  // weeks start on Sunday; partial edge weeks are scaled to a full week
  const weekStart = (k: number) => k - new Date(k * DAY).getUTCDay();
  const wk = new Map<number, { total: number; covered: number }>();
  for (let k = first; k <= last; k++) {
    const w = weekStart(k);
    const e = wk.get(w) ?? { total: 0, covered: 0 };
    e.total += daily.get(k) ?? 0;
    e.covered++;
    wk.set(w, e);
  }
  const weekly = [...wk.entries()].sort((a, b) => a[0] - b[0]).map(([w, e]) => ({ start: new Date(w * DAY), total: Math.round((e.total * 7) / e.covered) }));

  // simple linear trend on weekly totals (needs 3+ weeks), else the average
  const ys = weekly.map((w) => w.total);
  const n = ys.length;
  let slope = 0;
  let intercept = ys.reduce((a, b) => a + b, 0) / n;
  if (n >= 3) {
    const xm = (n - 1) / 2;
    const ym = intercept;
    let num = 0;
    let den = 0;
    ys.forEach((y, i) => {
      num += (i - xm) * (y - ym);
      den += (i - xm) ** 2;
    });
    slope = den ? num / den : 0;
    intercept = ym - slope * xm;
  }
  const forecast = [0, 1, 2, 3].map((j) => Math.max(0, Math.round(intercept + slope * (n + j))));
  const nextMonth = Math.round((forecast.reduce((a, b) => a + b, 0) / 28) * 30);
  const recent = ys.slice(-4);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const trendPct = recentAvg ? Math.round(((forecast[0] - recentAvg) / recentAvg) * 100) : 0;
  return { days, byWeekday, byCategory, weekly, forecast, nextMonth, trendPct };
}

// ---------------------------------------------------------------- samples
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface Sample {
  id: string;
  icon: string;
  title: string;
  sub: string;
  table: () => Table;
}
export const SAMPLES: Sample[] = [
  {
    id: 'expenses',
    icon: '💳',
    title: 'مصاريف طالب',
    sub: 'شهرين · قهوة، مطاعم، مواصلات',
    table: () => {
      const r = rng(7);
      const start = Date.UTC(2026, 8, 1);
      const cats: [string, number, number][] = [
        ['قهوة', 14, 22],
        ['مطاعم', 35, 70],
        ['مواصلات', 18, 30],
        ['تسوق', 60, 140],
        ['اشتراكات', 30, 45],
      ];
      const rows: Cell[][] = [];
      for (let d = 0; d < 61; d++) {
        const date = new Date(start + d * DAY);
        const wd = date.getUTCDay();
        const weekend = wd === 4 || wd === 5;
        const k = 1 + Math.floor(r() * (weekend ? 3 : 2));
        for (let j = 0; j < k; j++) {
          const [c, lo, hi] = cats[Math.min(4, Math.floor(r() * (weekend ? 4.4 : 3.2)))];
          rows.push([iso(date), Math.round(lo + r() * (hi - lo) * (weekend ? 1.3 : 1)), c]);
        }
      }
      const n = rows.length;
      rows.push([...rows[5]], [...rows[Math.floor(n * 0.4)]], [...rows[Math.floor(n * 0.75)]]);
      rows[12][1] = null;
      rows[Math.floor(n * 0.55)][1] = null;
      rows[Math.floor(n * 0.85)][0] = null;
      return { headers: ['التاريخ', 'المبلغ', 'البند'], rows };
    },
  },
  {
    id: 'cafe',
    icon: '☕',
    title: 'مبيعات كافيه الجامعة',
    sub: '8 أسابيع · وفيها أسابيع اختبارات',
    table: () => {
      const r = rng(21);
      const start = Date.UTC(2026, 8, 6);
      const rows: Cell[][] = [];
      for (let d = 0; d < 56; d++) {
        const date = new Date(start + d * DAY);
        const wd = date.getUTCDay();
        if (wd === 5) continue; // closed Fridays
        const exams = d >= 35 && d < 49;
        const base = wd === 6 ? 140 : 260;
        rows.push([iso(date), Math.round((base + d * 2.2) * (exams ? 1.45 : 1) * (0.85 + r() * 0.3)), exams ? 'أسبوع اختبارات' : 'عادي']);
      }
      rows.push([...rows[9]], [...rows[30]]);
      rows[17][1] = null;
      return { headers: ['التاريخ', 'المبيعات', 'نوع الأسبوع'], rows };
    },
  },
  {
    id: 'club',
    icon: '🎓',
    title: 'حضور فعاليات النادي',
    sub: '3 شهور · ورش ومحاضرات ومسابقات',
    table: () => {
      const r = rng(5);
      const start = Date.UTC(2026, 6, 5);
      const kinds = ['ورشة', 'محاضرة', 'مسابقة'];
      const rows: Cell[][] = [];
      for (let w = 0; w < 13; w++) {
        for (const off of [1, 3]) {
          const kind = kinds[Math.floor(r() * 3)];
          const base = kind === 'مسابقة' ? 55 : kind === 'ورشة' ? 40 : 28;
          rows.push([iso(new Date(start + (w * 7 + off) * DAY)), Math.round((base + w * 2.5) * (0.8 + r() * 0.4)), kind]);
        }
      }
      rows.push([...rows[6]]);
      rows[11][1] = null;
      return { headers: ['التاريخ', 'الحضور', 'نوع الفعالية'], rows };
    },
  },
];

export const fmtNum = (n: number) => Math.round(n).toLocaleString('en');
export const fmtDateAr = (d: Date) => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
