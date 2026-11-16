import { useEffect, useState } from 'react';
import { stationById } from './stations';
import { AVG_TICKET_SAR, HOURS, WEEKDAYS, fmtHour } from './dataset';
import { BAD_KPIS, Scope, eidOutcome, useProject } from './project';
import { WAGE_SAR_PER_HOUR } from './sim';
import { Impact, Inputs } from './Decision';
import { useStationState, useStore } from './store';
import { Step, StationOutro, StationShell, nextAfter, nextLabelFor, useFastSkip } from './Shell';
import { LiveRestaurant } from './LiveRestaurant';
import { Consequence } from './Consequence';
import { Button, Feedback, FeedbackKind, GovTip, cx } from './ui';
import { ChartType, DashboardView, FORECAST_DAY, KPI_DEFS, WidgetId } from './Dashboard';
import { Icon } from './Icon';

const meta = stationById('bi');
type ChartKey = 'hourly' | 'channel' | 'trend';
const CHART_Q: { k: ChartKey; title: string; opts: { t: ChartType; label: string; ok: boolean; note: string }[] }[] = [
  {
    k: 'hourly',
    title: 'متوسط الطلبات لكل ساعة (12 ساعة)',
    opts: [
      { t: 'bar', label: 'أعمدة', ok: true, note: 'ممتاز — الأعمدة تخلي المقارنة بين الساعات سهلة جدًا.' },
      { t: 'pie', label: 'دائري', ok: false, note: '12 شريحة متقاربة صعبة القراءة، والدائري يناسب "أجزاء من كل" وليس التسلسل الزمني.' },
      { t: 'line', label: 'خطي', ok: true, note: 'مقبول — الخط يوضح صعود ونزول الطلب خلال اليوم.' },
    ],
  },
  {
    k: 'channel',
    title: 'نسبة الصالة مقابل التوصيل',
    opts: [
      { t: 'line', label: 'خطي', ok: false, note: 'الخطي للتغير عبر الزمن. هنا عندنا جزءان من كل واحد.' },
      { t: 'donut', label: 'دائري مفرّغ', ok: true, note: 'ممتاز — جزءان من كل، الدائري واضح هنا.' },
      { t: 'bar', label: 'أعمدة', ok: true, note: 'مقبول — يقارن الرقمين بوضوح.' },
    ],
  },
  {
    k: 'trend',
    title: 'إجمالي الطلبات يوميًا خلال 4 أسابيع',
    opts: [
      { t: 'line', label: 'خطي', ok: true, note: 'ممتاز — الخط أفضل طريقة لعرض الاتجاه عبر الزمن.' },
      { t: 'pie', label: 'دائري', ok: false, note: '28 شريحة؟ مستحيل نقرأ الاتجاه منها.' },
      { t: 'table', label: 'جدول أرقام', ok: false, note: 'الجدول دقيق، لكن المدير ما راح يشوف النمط بنظرة سريعة.' },
    ],
  },
];
const WIDGETS: { id: WidgetId; label: string; desc: string }[] = [
  { id: 'kpis', label: 'شريط المؤشرات', desc: 'المؤشرات الأربعة اللي اخترتها' },
  { id: 'forecast', label: 'توقع ليلة العيد', desc: 'من نموذج تعلم الآلة' },
  { id: 'hourly', label: 'الطلبات حسب الساعة', desc: 'من تحليل البيانات' },
  { id: 'channel', label: 'الصالة مقابل التوصيل', desc: 'توزيع القنوات' },
  { id: 'trend', label: 'اتجاه 4 أسابيع', desc: 'إجمالي يومي' },
  { id: 'raw', label: 'جدول كل الطلبات الخام', desc: '336 صف بالتفصيل' },
];
const SCHEDULED = 5;

export function BusinessIntelligence() {
  const { dispatch, go } = useStore();
  const project = useProject();
  const [st, set] = useStationState('bi', {
    step: 0,
    kpis: [] as string[],
    charts: {} as Partial<Record<ChartKey, ChartType>>,
    board: [] as WidgetId[],
    planStaff: null as number | null,
    planScope: 'evening' as Scope,
  });
  const [fb, setFb] = useState<{ kind: FeedbackKind; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [trialStaffLocal, setTrialStaff] = useState<number>(SCHEDULED);
  const [oops, setOops] = useState(false);
  const skipped = useFastSkip(st, set, { 1: { charts: { hourly: 'bar', channel: 'donut', trend: 'line' } } });
  useEffect(() => setFb(null), [st.step]);

  // forecast from the participant's own model (stations 1→4)
  const fc = project.eidForecast;
  const peak = Math.max(...fc);
  const peakHour = HOURS[fc.indexOf(peak)];
  const need = project.recommendedStaff;
  const trialStaff = st.planStaff ?? trialStaffLocal;
  const trialOutcome = eidOutcome(fc, trialStaff, st.planScope);
  const planned = st.planStaff != null ? eidOutcome(fc, st.planStaff, st.planScope) : null;

  const toggleKpi = (k: string) => {
    if (st.step !== 0) return;
    if (st.kpis.includes(k)) return set({ kpis: st.kpis.filter((x) => x !== k) });
    if (st.kpis.length >= 4) return setFb({ kind: 'hint', text: 'اللوحة الجيدة مركّزة: 4 مؤشرات كحد أقصى. شيل واحد قبل ما تضيف غيره.' });
    set({ kpis: [...st.kpis, k] });
    setFb(KPI_DEFS[k].good ? null : { kind: 'hint', text: KPI_DEFS[k].why });
  };
  const kpiOk = st.kpis.length === 4;
  const kpiTier = st.kpis.some((k) => BAD_KPIS[k] === 'harm') ? 'harm' : st.kpis.some((k) => BAD_KPIS[k] === 'cost') ? 'cost' : 'best';
  const chartsOk = CHART_Q.every((q) => st.charts[q.k]);
  const chartsTier = CHART_Q.every((q) => q.opts.find((o) => o.t === st.charts[q.k])?.ok) ? 'best' : 'cost';

  const addWidget = (id: WidgetId) => {
    if (st.board.includes(id)) return set({ board: st.board.filter((x) => x !== id) });
    if (id === 'raw') return setFb({ kind: 'hint', text: '336 صف تفصيلي ما يساعد المدير ياخذ قرار بنظرة. التفاصيل مكانها تقرير منفصل للمحلل، مو لوحة الإدارة.' });
    if (st.board.length >= 4) return setFb({ kind: 'hint', text: 'اللوحة فيها 4 عناصر — هذا الحد الأقصى عشان تبقى واضحة. شيل عنصر أولًا.' });
    set({ board: [...st.board, id] });
    setFb(null);
  };
  const boardOk = st.board.includes('kpis') && st.board.includes('forecast') && st.board.length >= 3;

  const finish = () => {
    dispatch({ type: 'complete', id: 'bi', output: { kpis: st.kpis, decision: `${st.planStaff} موظفين — ${st.planScope === 'evening' ? 'المساء' : 'اليوم كامل'}` } });
    go(nextAfter('bi'));
  };

  return (
    <StationShell meta={meta}>
      <div className="rounded-2xl bg-white border border-ink-200 p-4 flex gap-3 items-start text-[15px]">
        <span className="shrink-0 mt-0.5" style={{ color: meta.color }}>
          <Icon name="user" />
        </span>
        <p className="text-ink-700">
          عندنا الحين بيانات نظيفة، تقرير تحليلي، ونموذج يتوقع. لكن صاحبة المطعم «أم فهد» ما عندها وقت تقرأ كود أو تقارير طويلة. تبي <b>شاشة وحدة</b> تفتحها كل صباح وتعرف منها وش تسوي.
        </p>
      </div>

      <Inputs
        items={[
          { label: 'تقرير التحليل', value: `ذروة ${fmtHour(project.stats.peak.hour)}`, color: '#3B6EF5' },
          { label: 'نموذجك', value: `خطأ ±${project.run.ev.realMae.toFixed(1)} على أسبوع جديد`, color: '#E8467C' },
          { label: 'توقع ليلة العيد', value: `${Math.round(peak)} طلب في الذروة`, color: '#E8467C' },
        ]}
      />
      <Step n={1} reached={st.step} title="اختر مؤشرات الأداء" instruction={<>اختر <b>4 مؤشرات</b> <bdi dir="ltr" className="font-mono text-sm">KPIs</bdi> تساعد المديرة في قرار الورديات.</>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {Object.entries(KPI_DEFS).map(([k, d]) => (
            <button
              key={k}
              disabled={st.step !== 0}
              onClick={() => toggleKpi(k)}
              aria-pressed={st.kpis.includes(k)}
              className={cx(
                'flex items-center gap-3 text-right rounded-xl border-2 px-4 py-3 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/25',
                st.kpis.includes(k) ? (d.good ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-amber-400 bg-amber-50') : 'border-ink-200 bg-white hover:border-ink-400',
              )}
            >
              <span className={cx('w-5 h-5 rounded-md border-2 grid place-items-center shrink-0', st.kpis.includes(k) ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-ink-300')}>
                {st.kpis.includes(k) && <Icon name="check" size={13} stroke={3} />}
              </span>
              <span className="font-medium">{d.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {fb && st.step === 0 && <Feedback kind={fb.kind}>{fb.text}</Feedback>}
          {kpiOk && (
            <Impact tier={kpiTier} title={kpiTier === 'best' ? 'مؤشرات مركّزة تخدم قرار التوظيف' : kpiTier === 'harm' ? 'لوحة فيها بيانات شخصية' : 'مؤشرات فيها تشتيت'}>
              {kpiTier === 'best'
                ? 'كل مؤشر يساعد أم فهد في قرار حقيقي.'
                : kpiTier === 'harm'
                ? 'أرقام جوالات العملاء بتظهر لكل من يفتح اللوحة. تقدر تكمل، لكن مراجعة الحوكمة بتوقفك عندها.'
                : 'بعض المؤشرات ما تخدم القرار وتشتت الانتباه. مقبول، لكن اللوحة أقل وضوحًا.'}
            </Impact>
          )}
          {st.step === 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-500 tabular-nums">{st.kpis.length}/4</span>
              <Button variant="accent" disabled={!kpiOk} onClick={() => set({ step: 1 })} iconEnd="arrow">
                التالي: اختر الرسوم
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={2} skipped={skipped(2)} reached={st.step} title="اختر نوع الرسم المناسب" instruction="لكل معلومة رسم يوضحها أفضل. اختر نوعًا لكل واحدة.">
        <div className="space-y-4">
          {CHART_Q.map((q) => {
            const chosen = q.opts.find((o) => o.t === st.charts[q.k]);
            return (
              <div key={q.k}>
                <div className="font-bold mb-2">{q.title}</div>
                <div className="flex flex-wrap gap-2">
                  {q.opts.map((o) => (
                    <button
                      key={o.t}
                      disabled={st.step !== 1}
                      onClick={() => set({ charts: { ...st.charts, [q.k]: o.t } })}
                      aria-pressed={st.charts[q.k] === o.t}
                      className={cx(
                        'flex items-center gap-2 rounded-xl border-2 px-3.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/25',
                        st.charts[q.k] === o.t ? (o.ok ? 'border-emerald-500 bg-emerald-50' : 'border-amber-400 bg-amber-50') : 'border-ink-200 hover:border-ink-400',
                      )}
                    >
                      <ChartGlyph t={o.t} />
                      {o.label}
                    </button>
                  ))}
                </div>
                {chosen && <p className={cx('text-sm mt-1.5', chosen.ok ? 'text-emerald-700' : 'text-amber-800')}>{chosen.note}</p>}
              </div>
            );
          })}
        </div>
        {st.step === 1 && (
          <div className="flex justify-end mt-4">
            <Button variant="accent" disabled={!chartsOk} onClick={() => set({ step: 2 })} iconEnd="arrow">
              التالي: ركّب اللوحة
            </Button>
          </div>
        )}
      </Step>

      <Step n={3} reached={st.step} title="ركّب لوحة المعلومات" instruction="اسحب العناصر إلى اللوحة (أو اضغط عليها). اختر 3–4 عناصر — لازم تشمل المؤشرات والتوقع.">
        <div className="grid md:grid-cols-[220px_1fr] gap-4">
          <ul className="space-y-2" aria-label="العناصر المتاحة">
            {WIDGETS.map((w) => {
              const on = st.board.includes(w.id);
              return (
                <li key={w.id}>
                  <button
                    draggable={st.step === 2 && !on}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', w.id)}
                    disabled={st.step !== 2}
                    onClick={() => addWidget(w.id)}
                    aria-pressed={on}
                    className={cx(
                      'w-full text-right rounded-xl border-2 px-3 py-2.5 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/25',
                      on ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-dashed border-ink-300 bg-white hover:border-ink-500 cursor-grab',
                    )}
                  >
                    <div className="font-bold text-sm flex items-center justify-between">
                      {w.label}
                      {on ? <Icon name="check" size={15} stroke={3} /> : <span className="text-ink-300">⠿</span>}
                    </div>
                    <div className="text-xs text-ink-500">{w.desc}</div>
                  </button>
                </li>
              );
            })}
          </ul>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const id = e.dataTransfer.getData('text/plain') as WidgetId;
              if (id && !st.board.includes(id)) addWidget(id);
            }}
            className={cx('rounded-2xl border-2 border-dashed p-3 min-h-[260px] transition-colors bg-ink-50', dragOver ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-ink-300')}
            aria-label="لوحة المعلومات"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="font-bold text-sm">لوحة DataBite الإدارية</div>
              <span className="text-xs text-ink-500 tabular-nums">{st.board.length}/4 عناصر</span>
            </div>
            {st.board.length === 0 ? (
              <div className="grid place-items-center h-48 text-ink-400 text-sm text-center">
                <div>
                  <Icon name="board" size={32} className="mx-auto mb-2" />
                  اسحب العناصر هنا
                </div>
              </div>
            ) : (
              <DashboardView widgets={st.board} kpis={st.kpis} charts={st.charts} compact accent={meta.color} />
            )}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {fb && st.step === 2 && <Feedback kind={fb.kind}>{fb.text}</Feedback>}
          {st.step === 2 && st.board.length >= 3 && !boardOk && <Feedback kind="hint">المديرة تحتاج تشوف المؤشرات وتوقع الخميس — بدونها ما تقدر تاخذ قرار.</Feedback>}
          <GovTip>{meta.govNote}</GovTip>
          {st.step === 1 && chartsOk && chartsTier === 'cost' && <Feedback kind="hint">بعض الرسوم ما تناسب معلومتها — تقدر تكمل، لكن قراءة اللوحة بتكون أصعب.</Feedback>}
          {st.step === 2 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={!boardOk} onClick={() => set({ step: 3 })} iconEnd="arrow">
                اللوحة جاهزة — جرّبها بقرار
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={4} reached={st.step} title="خطّط موظفي ليلة العيد" instruction={`${WEEKDAYS[FORECAST_DAY]} القادم ليلة العيد. نموذجك (من المحطة السابقة) يتوقع الطلبات تحت. الجدول الحالي ${SCHEDULED} موظفين. جرّب على المطعم الحي، ثم اعتمد خطتك — وبنشوف وش يصير في الليلة الحقيقية.`}>
        <div className="rounded-xl bg-[var(--accent-soft)] p-4 mb-4 grid sm:grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-ink-500">ذروة متوقعة (من نموذجك)</div>
            <div className="text-2xl font-bold tabular-nums">{Math.round(peak)}</div>
            <div className="text-xs text-ink-500">طلب الساعة {fmtHour(peakHour)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-500">النظام يقترح</div>
            <div className="text-2xl font-bold tabular-nums">{need}</div>
            <div className="text-xs text-ink-500">موظف لكل 8 طلبات/ساعة</div>
          </div>
          <div>
            <div className="text-xs text-ink-500">المجدولون حاليًا</div>
            <div className="text-2xl font-bold tabular-nums text-rose-600">{SCHEDULED}</div>
            <div className="text-xs text-ink-500">{need > SCHEDULED ? `نقص ${need - SCHEDULED}` : 'يكفي حسب التوقع'}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            موظفو المساء:
            <button className="w-9 h-9 rounded-lg border border-ink-200 font-bold hover:border-ink-400 disabled:opacity-40" disabled={st.step !== 3 || st.planStaff != null} onClick={() => setTrialStaff(Math.max(2, trialStaff - 1))} aria-label="موظف أقل">
              −
            </button>
            <b className="tabular-nums w-7 text-center text-xl">{trialStaff}</b>
            <button className="w-9 h-9 rounded-lg border border-ink-200 font-bold hover:border-ink-400 disabled:opacity-40" disabled={st.step !== 3 || st.planStaff != null} onClick={() => setTrialStaff(Math.min(16, trialStaff + 1))} aria-label="موظف أكثر">
              +
            </button>
          </div>
          <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1 text-sm" role="radiogroup" aria-label="فترة الموظفين الإضافيين">
            {(
              [
                ['evening', 'المساء فقط (18:00–00:00)'],
                ['allday', 'اليوم كامل'],
              ] as [Scope, string][]
            ).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={st.planScope === k} disabled={st.step !== 3 || st.planStaff != null} onClick={() => set({ planScope: k })} className={cx('rounded-lg px-3 py-1.5 font-semibold', st.planScope === k ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100')}>
                {l}
              </button>
            ))}
          </div>
          <span className="text-xs text-ink-500">تكلفة الرواتب الليلة: {trialOutcome.labor.toLocaleString('en')} ريال</span>
        </div>
        <LiveRestaurant hour={peakHour} orders={peak} staff={trialStaff} eid caption={`المعاينة حسب توقع نموذجك (${Math.round(peak)} طلب) — الليلة الحقيقية قد تختلف`} />
        <div className="mt-4 space-y-3">
          {st.step === 3 && !planned && (
            <div className="flex justify-end">
              <Button
                variant="accent"
                onClick={() => {
                  set({ planStaff: trialStaff });
                  if (eidOutcome(fc, trialStaff, st.planScope).tier === 'harm') setOops(true);
                }}
              >
                اعتمد الخطة وشوف ليلة العيد الحقيقية
              </Button>
            </div>
          )}
          {planned && (
            <Impact tier={planned.tier} title={`ليلة العيد الحقيقية بخطتك (${planned.staff} موظفين، ${planned.scope === 'evening' ? 'المساء' : 'اليوم كامل'})`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2 text-center">
                {[
                  ['عملاء زعلانين', planned.upset],
                  ['أقصى انتظار', `${planned.maxWait} د`],
                  ['تكلفة الرواتب', `${planned.labor.toLocaleString('en')} ر`],
                  ['خسارة مبيعات تقريبية', `${planned.lostRevenue.toLocaleString('en')} ر`],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg bg-white/70 p-2">
                    <div className="text-[11px] text-ink-500">{l}</div>
                    <div className="font-bold tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
              {planned.tier === 'best'
                ? 'خطة متوازنة: غطّت الذروة بدون رواتب زايدة. هذا هدف المشروع كله!'
                : planned.tier === 'cost'
                ? planned.scope === 'allday'
                  ? 'الزحمة انحلّت، لكن دفعت رواتب لساعات الظهر الهادئة. فيه خيار أوفر.'
                  : planned.upset > 0
                  ? 'قريب — لكن بعض العملاء انتظروا أكثر من اللازم.'
                  : 'الزحمة انحلّت، لكن بتكلفة رواتب أعلى من الحاجة.'
                : `الطلب الحقيقي في الذروة كان ${Math.round(Math.max(...project.eidTruth))} طلب.${Math.max(...project.eidTruth) - peak > 12 ? ' لاحظ: نموذجك قلّل التوقع — المشكلة بدأت قبل هذه المحطة.' : ''}`}
              <div className="text-xs text-ink-500 mt-2">
                الحساب: طلب الليلة الحقيقي (من المحاكاة) مقابل طاقة {8} طلبات/ساعة لكل موظف · أجر {WAGE_SAR_PER_HOUR} ريال/ساعة · متوسط الفاتورة {AVG_TICKET_SAR} ريال.
              </div>
            </Impact>
          )}
          {st.step === 3 && planned && (
            <div className="flex justify-between flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTrialStaff(st.planStaff ?? SCHEDULED);
                  set({ planStaff: null });
                }}
              >
                عدّل الخطة
              </Button>
              <Button variant="accent" onClick={() => set({ step: 4 })} iconEnd="arrow">
                اعتمد القرار
              </Button>
            </div>
          )}
        </div>
        <Consequence
          open={oops}
          headline="ليلة العيد، الساعة 9 مساءً…"
          story={`اعتمدت ${planned?.staff ?? trialStaff} موظفين. الطلب الحقيقي في الذروة ${Math.round(Math.max(...project.eidTruth))} طلب.`}
          hour={12 + project.eidTruth.indexOf(Math.max(...project.eidTruth))}
          orders={Math.max(...project.eidTruth)}
          staff={planned?.staff ?? trialStaff}
          eid
          lesson={`محسوبًا على الليلة كاملة: ${(planned ?? trialOutcome).upset} عميل زعلان وخسارة تقريبية ${(planned ?? trialOutcome).lostRevenue.toLocaleString('en')} ريال. لوحة المعلومات ما تفيد إذا ما غيّرت القرار — وما تفيد إذا كان التوقع اللي فيها ناقص.`}
          onRewind={() => {
            setOops(false);
            set({ planStaff: null });
          }}
          onProceed={() => setOops(false)}
        />
      </Step>

      {st.step >= 4 && (
        <StationOutro
          meta={meta}
          onContinue={finish}
          nextLabel={nextLabelFor('bi')}
          output={
            <div>
              <div className="text-2xl font-bold mb-2">لوحة معلومات إدارية تعمل</div>
              <p className="text-white/85">
                تعرض {st.kpis.length} مؤشرات، والطلب التاريخي، وتوقعات نموذجك — وساعدت في قرار: <b>{st.planStaff} موظفين ليلة العيد ({st.planScope === 'evening' ? 'المساء فقط' : 'اليوم كامل'})</b>.
              </p>
              {planned && (
                <p className="text-white/75 text-sm mt-1">
                  النتيجة الحقيقية: {planned.upset} عميل زعلان · رواتب {planned.labor.toLocaleString('en')} ريال
                </p>
              )}
              <p className="mt-3 text-white/80 text-sm">→ قبل الإطلاق: مراجعة الحوكمة. من يشوف وش؟ وهل البيانات محمية؟</p>
            </div>
          }
        />
      )}
    </StationShell>
  );
}

function ChartGlyph({ t }: { t: ChartType }) {
  const c = 'currentColor';
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true" className="text-ink-600">
      {t === 'bar' && [3, 8, 13, 18].map((x, i) => <rect key={x} x={x - 2} y={[8, 3, 10, 6][i]} width="3.5" height={18 - [8, 3, 10, 6][i]} rx="1" fill={c} />)}
      {t === 'line' && <path d="M1 15L6 9l5 3 5-8 5 4" stroke={c} strokeWidth="2" fill="none" strokeLinejoin="round" />}
      {t === 'pie' && <><circle cx="11" cy="9" r="8" fill={c} opacity=".3" /><path d="M11 9V1a8 8 0 0 1 7.5 10.8z" fill={c} /></>}
      {t === 'donut' && <><circle cx="11" cy="9" r="6.5" stroke={c} strokeWidth="3.5" fill="none" opacity=".3" /><path d="M11 2.5a6.5 6.5 0 0 1 6.2 8.5" stroke={c} strokeWidth="3.5" fill="none" /></>}
      {t === 'table' && <><rect x="1" y="1" width="20" height="16" rx="2" stroke={c} fill="none" strokeWidth="1.5" /><path d="M1 6h20M1 11h20M8 1v16" stroke={c} strokeWidth="1.5" /></>}
    </svg>
  );
}
