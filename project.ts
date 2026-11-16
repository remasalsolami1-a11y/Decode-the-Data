/**
 * The PROJECT: one chain of real computations driven by the participant's own decisions.
 *
 *   station 1 (missing-value strategy)  → cleaned dataset
 *   station 2 (reads that dataset)      → insights report (+ the conclusion they chose)
 *   station 3 (features + approach)     → what the model is allowed to see
 *   station 4 (training configuration)  → trained model + honest / reported evaluation
 *   station 5 (KPIs + staffing plan)    → dashboard + Eid-night outcome judged against the true world
 *   station 6 (governance)              → audit of everything above
 *
 * Nothing here is hard-coded per answer: change an upstream decision and every downstream number is recomputed.
 */
import { useMemo } from 'react';
import {
  AVG_TICKET_SAR, CleanResult, HOURS, MISSING_CELL, MissingStrategy, Stats, TRUTH, WEEKDAYS,
  buildDataset, computeStats, thu21, dateAr, dayDeviation, fmtHour, round1, staffFor, trueExpected, EID_NIGHT, PAYDAY_DAY,
} from './dataset';
import { BEST_FEATURES, FeatureId, ModelRun, TrainConfig, realInputs, runModel } from './model';
import { WAGE_SAR_PER_HOUR, simulate } from './sim';
import { AppState, StationId, useStore } from './store';

export type Tier = 'best' | 'cost' | 'harm';
export type Approach = 'overall' | 'hourly' | 'combined';
export type Conclusion = 'right' | 'flat' | 'weekendLow' | 'promo';
export type Scope = 'evening' | 'allday';

export interface Decisions {
  de: { missing: MissingStrategy; timeFmt: '24' | '12' };
  da: { conclusion: Conclusion; specialFound: number[] };
  ds: { features: FeatureId[]; approach: Approach };
  ml: { config: TrainConfig };
  bi: { kpis: string[]; charts: Record<string, string>; staff: number | null; scope: Scope };
  gov: { sensitive: string[]; qfix: string | null; ethic: string | null; disclaimer: boolean };
  /** where each station's decision came from */
  source: Record<StationId, 'participant' | 'default'>;
}

const SNIP_TO_CONFIG: Record<string, TrainConfig> = { a: 'same', b: 'small', c: 'honest' };
export const CONFIG_TO_SNIP: Record<TrainConfig, string> = { same: 'a', small: 'b', honest: 'c' };

type Any = Record<string, unknown>;
/** Read the participant's decisions straight from each station's saved state (single source of truth). */
export function decisionsFrom(state: Pick<AppState, 'station'>): Decisions {
  const s = (id: StationId) => (state.station[id] ?? {}) as Any;
  const de = s('de'), da = s('da'), ds = s('ds'), ml = s('ml'), bi = s('bi'), gov = s('gov');
  const has = (o: Any, k: string) => o[k] !== undefined && o[k] !== null && !(Array.isArray(o[k]) && !(o[k] as unknown[]).length);
  const dsFeat = has(ds, 'featuresDone') ? ((ds.features as FeatureId[]) ?? BEST_FEATURES) : BEST_FEATURES;
  return {
    de: { missing: (de.missing as MissingStrategy) ?? 'sameSlot', timeFmt: (de.timeFmt as '24' | '12') ?? '24' },
    da: { conclusion: (da.concl as Conclusion) ?? 'right', specialFound: (da.special as number[]) ?? [] },
    ds: { features: dsFeat, approach: (ds.approach as Approach) ?? 'combined' },
    ml: { config: SNIP_TO_CONFIG[(ml.snip as string) ?? 'c'] ?? 'honest' },
    bi: {
      kpis: has(bi, 'kpis') ? (bi.kpis as string[]) : ['avgDaily', 'peakHour', 'tonight', 'staff'],
      charts: (bi.charts as Record<string, string>) ?? {},
      staff: (bi.planStaff as number) ?? null,
      scope: (bi.planScope as Scope) ?? 'evening',
    },
    gov: { sensitive: (gov.sensitive as string[]) ?? [], qfix: (gov.qfix as string) ?? null, ethic: (gov.ethic as string) ?? null, disclaimer: !!gov.disclaimer },
    source: {
      de: has(de, 'missing') ? 'participant' : 'default',
      da: has(da, 'concl') ? 'participant' : 'default',
      ds: has(ds, 'featuresDone') || has(ds, 'approach') ? 'participant' : 'default',
      ml: has(ml, 'snip') ? 'participant' : 'default',
      bi: has(bi, 'planStaff') || has(bi, 'kpis') ? 'participant' : 'default',
      gov: has(gov, 'ethic') ? 'participant' : 'default',
    },
  };
}

/** The model actually gets these features (approach can override the selection). */
export function effectiveFeatures(ds: Decisions['ds']): FeatureId[] {
  if (ds.approach === 'overall') return [];
  if (ds.approach === 'hourly') return ['hour'];
  return ds.features;
}

// ---- tiers: best / acceptable with a cost / harmful -----------------------
export const TIER_LABEL: Record<Tier, string> = { best: 'الأفضل', cost: 'مقبول مع تكلفة', harm: 'ضار' };
export const TIER_COLOR: Record<Tier, string> = { best: '#16A34A', cost: '#D97706', harm: '#E11D48' };

export const missingTier = (m: MissingStrategy): Tier => (m === 'sameSlot' ? 'best' : m === 'zero' ? 'harm' : 'cost');
export const conclusionTier = (c: Conclusion): Tier => (c === 'right' ? 'best' : 'cost');
export function featuresTier(ds: Decisions['ds']): Tier {
  if (ds.approach === 'overall' || ds.features.includes('staff')) return 'harm';
  if (ds.approach === 'hourly') return 'cost';
  const missing = BEST_FEATURES.filter((f) => !ds.features.includes(f));
  const noise = ds.features.filter((f) => f === 'orderId' || f === 'temperature');
  return missing.length || noise.length ? 'cost' : 'best';
}
export const configTier = (c: TrainConfig): Tier => (c === 'honest' ? 'best' : c === 'small' ? 'cost' : 'harm');
export const BAD_KPIS: Record<string, Tier> = { phones: 'harm', followers: 'cost', temp: 'cost' };

// ---- the Eid-night test of the whole system -------------------------------
export const SCHEDULED_STAFF = 5;
export interface Outcome {
  staff: number;
  scope: Scope;
  hours: { hour: number; demand: number; forecast: number; staff: number; wait: number; upset: number }[];
  upset: number;
  maxWait: number;
  labor: number;
  optimalLabor: number;
  lostRevenue: number;
  tier: Tier;
}
export function eidOutcome(forecast: number[], staff: number, scope: Scope): Outcome {
  const hours = HOURS.map((hour, i) => {
    const demand = trueExpected({ weekday: 4, hour, eid: hour >= 18 });
    const st = scope === 'allday' || hour >= 18 ? staff : staffFor(forecast[i]);
    const sim = simulate(demand, st);
    return { hour, demand: round1(demand), forecast: forecast[i], staff: st, wait: sim.wait, upset: sim.upset };
  });
  const upset = hours.reduce((a, h) => a + h.upset, 0);
  const maxWait = Math.max(...hours.map((h) => h.wait));
  const labor = hours.reduce((a, h) => a + h.staff, 0) * WAGE_SAR_PER_HOUR;
  const optimalLabor = hours.reduce((a, h) => a + staffFor(h.demand), 0) * WAGE_SAR_PER_HOUR;
  const tier: Tier = upset >= 12 || maxWait >= 25 ? 'harm' : scope === 'allday' || labor > optimalLabor * 1.2 || upset >= 6 ? 'cost' : 'best';
  return { staff, scope, hours, upset, maxWait, labor, optimalLabor, lostRevenue: upset * AVG_TICKET_SAR, tier };
}

// ---- audit (governance reviews the participant's REAL decisions) ----------
export type Severity = 'critical' | 'warning' | 'info';
export interface Issue {
  id: string;
  station: StationId;
  severity: Severity;
  title: string;
  detail: string;
  /** station step to reopen when fixing */
  fixStep?: number;
  /** exactly what to change — shown in the audit and as a banner inside the station */
  hint?: string;
}

export interface Project {
  d: Decisions;
  clean: CleanResult;
  stats: Stats;
  deviation: ReturnType<typeof dayDeviation>;
  features: FeatureId[];
  run: ModelRun;
  /** forecast for next Eid night (Thursday), from the participant's own model */
  eidForecast: number[];
  eidTruth: number[];
  recommendedStaff: number;
  outcome: Outcome;
  tiers: Record<StationId, Tier>;
  audit: Issue[];
  key: string;
}

export function computeProject(d: Decisions): Project {
  const clean = buildDataset(d.de.missing);
  const stats = computeStats(clean.rows);
  const deviation = dayDeviation(clean.rows);
  const features = effectiveFeatures(d.ds);
  const run = runModel(clean.rows, d.de.missing, features, d.ml.config);
  const eidForecast = HOURS.map((h) => round1(run.model.predict(realInputs({ weekday: 4, hour: h, promo: false, event: false, eid: h >= 18, day: 60 }))));
  const eidTruth = HOURS.map((h) => round1(trueExpected({ weekday: 4, hour: h, eid: h >= 18 })));
  const recommendedStaff = staffFor(Math.max(...eidForecast));
  const outcome = eidOutcome(eidForecast, d.bi.staff ?? recommendedStaff, d.bi.scope);
  const kpiTier: Tier = d.bi.kpis.some((k) => BAD_KPIS[k] === 'harm') ? 'harm' : d.bi.kpis.some((k) => BAD_KPIS[k] === 'cost') ? 'cost' : 'best';
  const worst = (...ts: Tier[]): Tier => (ts.includes('harm') ? 'harm' : ts.includes('cost') ? 'cost' : 'best');
  const tiers: Record<StationId, Tier> = {
    de: missingTier(d.de.missing),
    da: conclusionTier(d.da.conclusion),
    ds: featuresTier(d.ds),
    ml: configTier(d.ml.config),
    bi: worst(kpiTier, outcome.tier),
    gov: d.gov.ethic && d.gov.ethic !== 'consent' ? 'harm' : 'best',
  };
  const p = { d, clean, stats, deviation, features, run, eidForecast, eidTruth, recommendedStaff, outcome, tiers, audit: [] as Issue[], key: JSON.stringify([d.de, d.da.conclusion, d.ds, d.ml, d.bi]) };
  p.audit = audit(p);
  return p;
}

const pct = (a: number, b: number) => Math.round((a / b - 1) * 100);

export function audit(p: Omit<Project, 'audit'>): Issue[] {
  const out: Issue[] = [];
  const { d, clean, run, outcome } = p;
  const best = computeStatsBest();
  // station 1
  if (d.de.missing === 'zero')
    out.push({ id: 'de-zero', station: 'de', severity: 'critical', fixStep: 2, title: `${clean.affected} ساعة ذروة سُجّلت بصفر طلبات صالة`, detail: `متوسط الخميس 9 مساءً في البيانات صار ${thu21(clean.rows)} بدل ${thu21(best.rows)}. الخطأ انتقل للتحليل والنموذج وتوقع ليلة العيد.` , hint: 'اختر «متوسط نفس اليوم والساعة» لمعالجة القيم المفقودة.' });
  if (d.de.missing === 'overall')
    out.push({ id: 'de-overall', station: 'de', severity: 'warning', fixStep: 2, title: `${clean.affected} قيمة عُوّضت بمتوسط عام لا يناسب ساعات الذروة`, detail: `الساعات المفقودة كلها ذروة مسائية، فالمتوسط العام قلّلها. متوسط الخميس 9 مساءً: ${thu21(clean.rows)} بدل ${thu21(best.rows)}.` , hint: 'اختر «متوسط نفس اليوم والساعة» بدل المتوسط العام.' });
  if (d.de.missing === 'drop')
    out.push({ id: 'de-drop', station: 'de', severity: 'info', fixStep: 2, title: `حُذف ${clean.removed} سجل من 336`, hint: 'اختر «متوسط نفس اليوم والساعة» بدل حذف الصفوف.', detail: 'خسرنا ساعات ذروة من البيانات. الأثر على النموذج صغير هنا، لكن الحذف المتكرر يجعل البيانات لا تمثّل أهم الأوقات.' });
  // station 2
  if (d.da.conclusion === 'promo')
    out.push({ id: 'da-cause', station: 'da', severity: 'warning', fixStep: 3, title: 'تقرير التحليل يدّعي سببًا لم تثبته البيانات', detail: '«العروض سبب زحمة الخميس» فرضية، لا استنتاج. الإدارة قد تبني قرارًا تسويقيًا على ادعاء غير مثبت.' , hint: 'اختر الاستنتاج اللي يصف النمط فقط (الذروة مساءً، والويكند أعلى) بدون ادعاء سبب.' });
  // station 3
  if (d.ds.features.includes('staff') && d.ds.approach === 'combined')
    out.push({ id: 'ds-leak', station: 'ds', severity: 'critical', fixStep: 3, title: 'تسرّب بيانات: «عدد الموظفين» داخل النموذج', detail: `في الاختبار ظهر الخطأ ±${run.ev.mae.toFixed(1)}، لكن عند الاستخدام الحقيقي (عدد الموظفين غير معروف مسبقًا) الخطأ ±${run.ev.realMae.toFixed(1)}.` , hint: 'شيل «عدد الموظفين» من الخصائص، ثم اضغط «اعتمد الخصائص».' });
  if (d.ds.approach === 'overall')
    out.push({ id: 'ds-flat', station: 'ds', severity: 'critical', fixStep: 4, title: 'المنهج المختار يتوقع رقمًا واحدًا لكل الساعات', detail: `توقع ليلة العيد الساعة 9: ${Math.round(p.eidForecast[9])} طلب، والطلب الحقيقي المتوقع ${Math.round(p.eidTruth[9])}.` , hint: 'اختر منهج «نموذج يجمع العوامل».' });
  if (d.ds.approach === 'hourly')
    out.push({ id: 'ds-hourly', station: 'ds', severity: 'warning', fixStep: 4, title: 'المنهج لا يعرف المناسبات (العيد، الراتب، الفعاليات)', detail: `توقع ذروة ليلة العيد ${Math.round(Math.max(...p.eidForecast))} طلب مقابل ${Math.round(Math.max(...p.eidTruth))} في الواقع.` , hint: 'اختر منهج «نموذج يجمع العوامل».' });
  if (d.ds.approach === 'combined') {
    const missing = BEST_FEATURES.filter((f) => !d.ds.features.includes(f));
    if (missing.includes('eid'))
      out.push({ id: 'ds-noeid', station: 'ds', severity: 'critical', fixStep: 3, title: 'النموذج لا يعرف ليلة العيد', detail: `يتوقع ذروة ليلة العيد ${Math.round(Math.max(...p.eidForecast))} طلب بينما الواقع حوالي ${Math.round(Math.max(...p.eidTruth))}. التوظيف بيطلع ناقص.` , hint: 'أضف «ليلة العيد» للخصائص، ثم اضغط «اعتمد الخصائص».' });
    const others = missing.filter((f) => f !== 'eid');
    if (others.length)
      out.push({ id: 'ds-missing', station: 'ds', severity: 'warning', fixStep: 3, title: `خصائص مفيدة غير مستخدمة: ${others.map((f) => FEATURE_AR[f]).join('، ')}`, detail: `النموذج لا يميّز هذه الأيام، فيخطئ فيها أكثر. الخطأ الحقيقي الحالي ±${run.ev.realMae.toFixed(1)}.`, hint: `أضف للخصائص: ${others.map((f) => FEATURE_AR[f]).join('، ')}، ثم اضغط «اعتمد الخصائص».` });
    if (d.ds.features.includes('orderId'))
      out.push({ id: 'ds-id', station: 'ds', severity: 'info', fixStep: 3, title: 'رقم السجل (ID) مستخدم كخاصية', detail: 'المعرّف لا علاقة له بالطلب. هنا ما ضرّ النموذج كثيرًا، لكنه قد يلتقط «اتجاهًا زمنيًا» بالصدفة ويضلّل لاحقًا.' });
    if (d.ds.features.includes('temperature'))
      out.push({ id: 'ds-temp', station: 'ds', severity: 'info', fixStep: 3, title: 'درجة الحرارة مستخدمة رغم ضعف علاقتها', detail: 'تضيف ضجيجًا بسيطًا. نراقب: هل تحسّن التوقع فعلًا؟' });
  }
  // station 4
  if (d.ml.config === 'same')
    out.push({ id: 'ml-same', station: 'ml', severity: 'critical', fixStep: 0, title: 'نموذج «حافظ» قُيّم على نفس بياناته', detail: `التقييم أعلن خطأ ±${run.ev.mae.toFixed(1)} (مثالي!)، لكن على أسبوع جديد الخطأ الحقيقي ±${run.ev.realMae.toFixed(1)}. الفريق كله وثق برقم غير صادق، والنموذج ما يعرف ليلة العيد.` , hint: 'اختر «يذاكر 3 أسابيع، ويُختبر بالرابع» ثم درّب النموذج من جديد.' });
  if (d.ml.config === 'small' && d.ds.features.includes('eid'))
    out.push({ id: 'ml-small', station: 'ml', severity: 'warning', fixStep: 0, title: 'التدريب على أسبوعين فقط — النموذج لم يرَ ليلة العيد', detail: `ليلة العيد في الأسبوع الثالث، فما تعلّم أثرها: يتوقع ذروتها ${Math.round(Math.max(...p.eidForecast))} طلب مقابل ${Math.round(Math.max(...p.eidTruth))}.` , hint: 'اختر «يذاكر 3 أسابيع، ويُختبر بالرابع» ثم درّب النموذج من جديد.' });
  // station 5
  if (d.bi.kpis.includes('phones'))
    out.push({ id: 'bi-phones', station: 'bi', severity: 'critical', fixStep: 0, title: 'أرقام جوالات العملاء معروضة في لوحة الإدارة', detail: 'بيانات شخصية في شاشة يشوفها كل من يفتح اللوحة — مخالفة لمبدأ أقل صلاحية لازمة.' , hint: 'شيل «أرقام جوالات العملاء» من المؤشرات واختر مؤشرًا يخدم قرار التوظيف.' });
  const noise = d.bi.kpis.filter((k) => BAD_KPIS[k] === 'cost');
  if (noise.length)
    out.push({ id: 'bi-noise', station: 'bi', severity: 'info', fixStep: 0, title: 'مؤشرات لا تخدم قرار التوظيف في اللوحة', detail: 'تشتت المديرة عن الأرقام المهمة.' });
  const scopeAr = d.bi.scope === 'allday' ? 'اليوم كامل' : 'المساء فقط';
  const planAr = `خطتك: ${outcome.staff} موظف (${scopeAr})`;
  const needTruth = staffFor(Math.max(...p.eidTruth));
  if (d.bi.staff !== null || d.bi.scope === 'allday') {
    if (outcome.tier === 'harm')
      out.push({ id: 'bi-under', station: 'bi', severity: 'critical', fixStep: 3, title: `قرار التوظيف ترك ${outcome.upset} عميل زعلان ليلة العيد`, detail: `${planAr}. أقصى انتظار ${outcome.maxWait} دقيقة، وخسارة تقريبية ${outcome.lostRevenue.toLocaleString('en')} ريال.`, hint: `اضغط «عدّل الخطة» وزِد موظفي المساء. ذروة ليلة العيد الحقيقية كانت تحتاج حوالي ${needTruth} موظف.` });
    else if (outcome.tier === 'cost' && outcome.upset >= 6)
      out.push({ id: 'bi-tight', station: 'bi', severity: 'warning', fixStep: 3, title: `${outcome.upset} عميل انتظروا أكثر من اللازم ليلة العيد`, detail: `${planAr}. أقصى انتظار ${outcome.maxWait} دقيقة — قريب من الحاجة لكنه ناقص قليلًا.`, hint: `اضغط «عدّل الخطة» وزِد موظف أو اثنين للمساء (الذروة كانت تحتاج حوالي ${needTruth}).` });
    else if (outcome.tier === 'cost')
      out.push({ id: 'bi-over', station: 'bi', severity: 'warning', fixStep: 3, title: 'تكلفة رواتب أعلى من اللازم', detail: `${planAr}. الرواتب ${outcome.labor.toLocaleString('en')} ريال مقابل ${outcome.optimalLabor.toLocaleString('en')} لو كان التوظيف مطابقًا للطلب (+${pct(outcome.labor, outcome.optimalLabor)}%).`, hint: d.bi.scope === 'allday' ? `اضغط «عدّل الخطة»، ثم اختر «المساء فقط» بدل «اليوم كامل» — الظهر هادئ وما يحتاج موظفين إضافيين — وخلّ العدد قريب من ${p.recommendedStaff}.` : `اضغط «عدّل الخطة» وقلّل موظفي المساء إلى حوالي ${p.recommendedStaff}.` });
  }
  return out;
}

export const FEATURE_AR: Record<string, string> = {
  hour: 'الساعة', weekday: 'يوم الأسبوع', promo: 'عرض ترويجي', event: 'فعالية الكورنيش', eid: 'ليلة العيد', payday: 'يوم الراتب',
  temperature: 'درجة الحرارة', staff: 'عدد الموظفين', orderId: 'رقم السجل', ramadan: 'رمضان',
};

let bestCache: CleanResult | null = null;
function computeStatsBest() {
  return (bestCache ??= buildDataset('sameSlot'));
}

// ---- lineage: follow one number from the cash register to the dashboard ----
export function traceNumber(p: Project) {
  const raw = TRUTH.find((r) => r.day === MISSING_CELL.day && r.hour === MISSING_CELL.hour)!;
  const cleaned = p.clean.rows.find((r) => r.day === MISSING_CELL.day && r.hour === MISSING_CELL.hour);
  const thuAvg = thu21(p.clean.rows);
  const pred = p.run.model.predict(realInputs(raw));
  return {
    when: `الخميس ${dateAr(raw.date)} الساعة ${fmtHour(MISSING_CELL.hour)}`,
    rawDelivery: raw.delivery,
    cleanedDinein: cleaned ? cleaned.dinein : null,
    cleanedOrders: cleaned ? cleaned.orders : null,
    trueOrders: raw.orders,
    thu21: thuAvg,
    prediction: round1(pred),
    eidForecast21: Math.round(p.eidForecast[9]),
    staff: p.d.bi.staff ?? p.recommendedStaff,
  };
}

export const SPECIAL = { EID_NIGHT, PAYDAY_DAY };

// ---- React hook -------------------------------------------------------------
export function useProject(): Project {
  const { state } = useStore();
  const d = decisionsFrom(state);
  const key = JSON.stringify(d);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => computeProject(d), [key]);
}

export const weekdayAr = (i: number) => WEEKDAYS[i];
