import { HOURS, WEEKDAYS, dailyTotals, fmtHour, round1, staffFor } from './dataset';
import { FeatureId, crowdLevel, realInputs } from './model';
import { Project, useProject } from './project';
import { BarChart, Donut, LineChart } from './charts';

export type WidgetId = 'kpis' | 'forecast' | 'hourly' | 'channel' | 'trend' | 'raw';
export type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'table';
export const KPI_DEFS: Record<string, { label: string; good: boolean; why: string }> = {
  avgDaily: { label: 'متوسط الطلبات اليومية', good: true, why: '' },
  peakHour: { label: 'ساعة الذروة', good: true, why: '' },
  tonight: { label: 'الطلبات المتوقعة الليلة', good: true, why: '' },
  staff: { label: 'الموظفون المطلوبون للذروة', good: true, why: '' },
  delivery: { label: 'نسبة طلبات التوصيل', good: true, why: '' },
  followers: { label: 'عدد متابعي إنستقرام', good: false, why: 'مؤشر تسويقي مفيد لفريق آخر، لكنه ما يساعد في قرار الورديات.' },
  phones: { label: 'أرقام جوالات العملاء', good: false, why: 'هذا مو مؤشر أصلًا — وهي بيانات شخصية حساسة ما مكانها لوحة إدارية!' },
  temp: { label: 'متوسط درجة الحرارة', good: false, why: 'عالم البيانات وجد علاقتها بالطلب ضعيفة — بتشتت المدير بدون فائدة.' },
};

export const FORECAST_DAY = 4; // next Thursday
export const FORECAST_EID = true; // …is the night before Eid

/** What-if scenario used by the dashboard (defaults to next Eid night). */
export interface Scenario {
  weekday: number;
  eid: boolean;
  event: boolean;
  promo: boolean;
  payday: boolean;
  /** clearly-labelled manual adjustment on top of the model (e.g. a group booking) */
  adjust: number;
}
export const EID_SCENARIO: Scenario = { weekday: FORECAST_DAY, eid: FORECAST_EID, event: false, promo: false, payday: false, adjust: 0 };
export function scenarioForecast(p: Project, sc: Scenario = EID_SCENARIO) {
  return HOURS.map((h) =>
    round1(
      p.run.model.predict(realInputs({ weekday: sc.weekday, hour: h, promo: sc.promo, event: sc.event && h >= 19, eid: sc.eid && h >= 18, payday: sc.payday, day: 60 })) * (1 + sc.adjust / 100),
    ),
  );
}
export const scenarioName = (sc: Scenario) =>
  [WEEKDAYS[sc.weekday], sc.eid && 'ليلة العيد', sc.payday && 'يوم الراتب', sc.event && 'فعالية', sc.promo && 'عرض', sc.adjust ? `${sc.adjust > 0 ? '+' : ''}${sc.adjust}%` : null].filter(Boolean).join(' · ');
/** @deprecated kept for older call sites */
export function forecastFor(_features: FeatureId[]) {
  return [] as number[];
}

export function DashboardView({
  widgets,
  kpis,
  charts,
  compact,
  accent = '#F59E0B',
  scenario = EID_SCENARIO,
}: {
  widgets: WidgetId[];
  kpis: string[];
  charts: Partial<Record<'hourly' | 'channel' | 'trend', ChartType>>;
  features?: FeatureId[];
  compact?: boolean;
  accent?: string;
  scenario?: Scenario;
}) {
  const p = useProject();
  const STATS = p.stats;
  const DATA = p.clean.rows;
  const fc = scenarioForecast(p, scenario);
  const peakFc = Math.max(...fc);
  const peakFcHour = HOURS[fc.indexOf(peakFc)];
  const kpiValue = (k: string) => {
    switch (k) {
      case 'avgDaily':
        return [String(STATS.avgDaily), 'طلب/يوم'];
      case 'peakHour':
        return [fmtHour(STATS.peak.hour), 'تاريخيًا'];
      case 'tonight':
        return [String(Math.round(fc.reduce((a, b) => a + b, 0))), `توقع: ${scenarioName(scenario)}`];
      case 'staff':
        return [String(staffFor(peakFc)), `الساعة ${fmtHour(peakFcHour)}`];
      case 'delivery':
        return [`${Math.round(STATS.deliveryShare * 100)}%`, 'من الطلبات'];
      case 'followers':
        return ['12.4K', 'لا يرتبط بقرار التوظيف'];
      case 'phones':
        return ['05•• ••• 871 …', '⚠ بيانات شخصية'];
      case 'temp':
        return ['33°', 'علاقة ضعيفة بالطلب'];
      default:
        return ['—', ''];
    }
  };
  const totals = dailyTotals(DATA);
  const dinein = DATA.reduce((s, r) => s + r.dinein, 0);
  const delivery = DATA.reduce((s, r) => s + r.delivery, 0);

  const card = 'rounded-xl bg-white border border-ink-200/70 p-3 sm:p-4';
  return (
    <div className="space-y-3">
      {widgets.includes('kpis') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {kpis.map((k) => {
            const [v, s] = kpiValue(k);
            return (
              <div key={k} className={card}>
                <div className="text-xs text-ink-500">{KPI_DEFS[k].label}</div>
                <div className="text-2xl font-bold tabular-nums mt-0.5" dir="ltr" style={{ textAlign: 'right' }}>
                  {v}
                </div>
                <div className="text-[11px] text-ink-400">{s}</div>
              </div>
            );
          })}
        </div>
      )}
      <div className={compact ? 'grid gap-3' : 'grid md:grid-cols-2 gap-3'}>
        {widgets.includes('forecast') && (
          <div className={card}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold">التوقع: {scenarioName(scenario)}</div>
              <span className="text-[11px] rounded-full px-2 py-0.5 font-bold text-white" style={{ background: crowdLevel(peakFc).color }}>
                الذروة: {crowdLevel(peakFc).label}
              </span>
            </div>
            <BarChart ariaLabel="توقع الطلبات لليلة العيد" values={fc.map(Math.round)} labels={HOURS.map(String)} color="#E8467C" height={180} highlight={HOURS.indexOf(peakFcHour)} />
            <div className="text-[11px] text-ink-400 mt-1">من نموذجك في محطة تعلم الآلة · تقديرات تعليمية وليست ضمانات</div>
          </div>
        )}
        {widgets.includes('hourly') && (
          <div className={card}>
            <div className="text-sm font-bold mb-1">متوسط الطلبات حسب الساعة</div>
            {charts.hourly === 'line' ? (
              <LineChart ariaLabel="متوسط الطلبات حسب الساعة" labels={HOURS.map(String)} series={[{ name: 'متوسط', values: STATS.byHour.map((x) => x.value), color: accent, area: true }]} height={180} />
            ) : (
              <BarChart ariaLabel="متوسط الطلبات حسب الساعة" values={STATS.byHour.map((x) => x.value)} labels={HOURS.map(String)} color={accent} height={180} />
            )}
          </div>
        )}
        {widgets.includes('channel') && (
          <div className={card}>
            <div className="text-sm font-bold mb-3">الصالة مقابل التوصيل</div>
            {charts.channel === 'bar' ? (
              <BarChart ariaLabel="الصالة مقابل التوصيل" values={[dinein, delivery]} labels={['Dine-in', 'Delivery']} color={accent} height={160} showValues />
            ) : (
              <Donut
                ariaLabel="الصالة مقابل التوصيل"
                parts={[
                  { label: 'الصالة', value: dinein, color: accent },
                  { label: 'التوصيل', value: delivery, color: '#111833' },
                ]}
              />
            )}
          </div>
        )}
        {widgets.includes('trend') && (
          <div className={card}>
            <div className="text-sm font-bold mb-1">إجمالي الطلبات اليومية — 4 أسابيع</div>
            {charts.trend === 'bar' ? (
              <BarChart ariaLabel="الطلبات اليومية" values={totals.map((t) => t.total)} labels={totals.map((_, i) => (i % 7 === 0 ? `W${i / 7 + 1}` : ''))} color={accent} height={180} />
            ) : (
              <LineChart ariaLabel="الطلبات اليومية" labels={totals.map((_, i) => (i % 7 === 0 ? `W${i / 7 + 1}` : ''))} series={[{ name: 'يومي', values: totals.map((t) => t.total), color: accent, area: true }]} height={180} />
            )}
          </div>
        )}
        {widgets.includes('raw') && (
          <div className={card}>
            <div className="text-sm font-bold mb-1">كل الطلبات الخام</div>
            <div className="text-xs text-ink-500">{DATA.length} صف…</div>
          </div>
        )}
      </div>
    </div>
  );
}
