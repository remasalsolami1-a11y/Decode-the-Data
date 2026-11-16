import { useEffect, useMemo, useState } from 'react';
import { stationById } from './stations';
import { EID_NIGHT, HOURS, HourRecord, PAYDAY_DAY, PROMO_DAYS, SPECIAL_DAYS, Stats, WEEKDAYS, avgByHour, avgByWeekdayHour, dateAr, dayDeviation, fmtHour, hourLabelAr } from './dataset';
import { conclusionTier, useProject } from './project';
import { Impact, Inputs } from './Decision';
import { useStationState, useStore } from './store';
import { Step, StationOutro, StationShell, nextAfter, nextLabelFor, useFastSkip } from './Shell';
import { Button, Chip, Feedback, FeedbackKind, GovTip, OptionCard, Stat, cx, En } from './ui';
import { BarChart, Heatmap } from './charts';
import { Icon } from './Icon';

const meta = stationById('da');
type Filter = 'all' | 'work' | 'weekend' | `d${number}`;
const WORK = [0, 1, 2, 3];
const WEEKEND = [4, 5, 6];
const filterRows = (DATA: HourRecord[], f: Filter) =>
  f === 'all' ? DATA : f === 'work' ? DATA.filter((r) => WORK.includes(r.weekday)) : f === 'weekend' ? DATA.filter((r) => WEEKEND.includes(r.weekday)) : DATA.filter((r) => r.weekday === Number(f.slice(1)));
const filterName = (f: Filter) => (f === 'all' ? 'كل الأيام' : f === 'work' ? 'أيام العمل' : f === 'weekend' ? 'نهاية الأسبوع' : WEEKDAYS[Number(f.slice(1))]);

function heatOf(rows: HourRecord[]) {
  const HEAT = avgByWeekdayHour(rows);
  let best: [number, number] = [0, 0];
  HEAT.forEach((row, r) => row.forEach((v, c) => v > HEAT[best[0]][best[1]] && (best = [r, c])));
  return { HEAT, HEAT_MAX: best };
}
const topDays = (STATS: Stats) => [...STATS.byWeekday.map((v, i) => [v, i])].sort((a, b) => b[0] - a[0]).slice(0, 2).map((x) => x[1]);

type Concl = 'right' | 'flat' | 'weekendLow' | 'promo';

export function DataAnalysis() {
  const { dispatch, go } = useStore();
  const project = useProject();
  const DATA = project.clean.rows;
  const STATS = project.stats;
  const { HEAT, HEAT_MAX } = useMemo(() => heatOf(DATA), [DATA]);
  const TOP_DAYS = topDays(STATS);
  const [st, set] = useStationState('da', {
    step: 0,
    filter: 'all' as Filter,
    peakFound: false,
    compared: false,
    cell: null as [number, number] | null,
    special: [] as number[],
    concl: null as Concl | null,
  });
  const skipped = useFastSkip(st, set, { 1: { cell: HEAT_MAX } });
  const [fb, setFb] = useState<{ kind: FeedbackKind; text: string } | null>(null);
  useEffect(() => setFb(null), [st.step]);

  const series = useMemo(() => avgByHour(filterRows(DATA, st.filter)), [DATA, st.filter]);
  const work = useMemo(() => avgByHour(filterRows(DATA, 'work')), [DATA]);
  const weekend = useMemo(() => avgByHour(filterRows(DATA, 'weekend')), [DATA]);
  const [compareMode, setCompareMode] = useState(false);

  const clickBar = (i: number) => {
    if (st.step !== 0) return;
    const vals = compareMode ? weekend.map((x) => x.value) : series.map((x) => x.value);
    const maxI = vals.indexOf(Math.max(...vals));
    if (i === maxI) {
      set({ peakFound: true });
      setFb({ kind: 'success', text: `صح! في "${compareMode ? 'نهاية الأسبوع' : filterName(st.filter)}" الذروة الساعة ${fmtHour(HOURS[i])} بمتوسط ${vals[i]} طلب في الساعة.` });
    } else if (st.peakFound) {
      setFb({ kind: 'info', text: `الساعة ${fmtHour(HOURS[i])} متوسطها ${vals[i]} طلب. (ساعة الذروة حدّدتها خلاص ✓${st.compared ? '' : ' — باقي تضغط «قارن»'})` });
    } else {
      setFb({ kind: 'hint', text: `الساعة ${fmtHour(HOURS[i])} متوسطها ${vals[i]} طلب. فيه عمود أطول — دوّر على أعلى نقطة.` });
    }
  };

  const conclusions: { k: Concl; t: string; fb: { kind: FeedbackKind; text: string } }[] = [
    {
      k: 'flat',
      t: 'المطعم مزدحم بنفس الدرجة تقريبًا طول اليوم.',
      fb: { kind: 'hint', text: `الرسم يقول غير كذا: الساعة 4 عصرًا متوسطها ${STATS.quiet.value} طلب فقط، بينما 9 مساءً ${STATS.peak.value}. الفرق أكثر من 4 أضعاف!` },
    },
    {
      k: 'right',
      t: `الذروة الكبرى مساءً بين 8 و10 (أعلاها ${hourLabelAr(STATS.peak.hour)})، وأكثر الأيام ازدحامًا ${WEEKDAYS[TOP_DAYS[0]]} و${WEEKDAYS[TOP_DAYS[1]]}، وفيه ذروة أصغر وقت الغداء.`,
      fb: { kind: 'success', text: 'بالضبط. هذا استنتاج تدعمه الرسوم مباشرة: متى، وأي يوم، وكم الفرق. ما ادعينا سببًا — وصفنا النمط فقط.' },
    },
    {
      k: 'weekendLow',
      t: 'الطلبات تقل في نهاية الأسبوع لأن الناس يطبخون في البيت.',
      fb: { kind: 'hint', text: 'ارجع لمقارنة أيام العمل مع نهاية الأسبوع — الأعمدة البرتقالية أعلى. وكمان "لأن الناس يطبخون" سبب ما تقوله البيانات.' },
    },
    {
      k: 'promo',
      t: 'العروض الترويجية هي سبب ازدحام ليلة الخميس.',
      fb: { kind: 'hint', text: 'هذه الرسوم ما فيها أي معلومة عن العروض — هذا ادعاء سبب، مو نمط شفناه. تقدر تعتمده، لكن التقرير بيحمل ادعاء غير مثبت وبتلاحظه مراجعة الحوكمة.' },
    },
  ];

  const finish = () => {
    dispatch({ type: 'complete', id: 'da', output: { peakHour: STATS.peak.hour, busiestDay: STATS.busiestDay, conclusion: conclusions.find((c) => c.k === st.concl)?.t ?? conclusions[1].t } });
    go(nextAfter('da'));
  };

  const weekendLift = Math.round((Math.max(...weekend.map((x) => x.value)) / Math.max(...work.map((x) => x.value)) - 1) * 100);

  return (
    <StationShell meta={meta}>
      <div className="rounded-2xl bg-white border border-ink-200 p-4 flex gap-3 items-start text-[15px]">
        <span className="shrink-0 mt-0.5" style={{ color: meta.color }}>
          <Icon name="table" />
        </span>
        <p className="text-ink-700">
          استلمنا من هندسة البيانات جدولًا فيه <b className="tabular-nums">{DATA.length}</b> سجل (4 أسابيع). كل رسم هنا محسوب من الجدول اللي جهّزته أنت — لو غيّرت قرار التنظيف، تتغير الأرقام هنا. مهمتك: تخلي البيانات تتكلم.
        </p>
      </div>
      <Inputs
        items={[
          { label: 'سجلات نظيفة', value: DATA.length, color: '#0891B2' },
          { label: 'القيم المفقودة', value: { sameSlot: 'متوسط نفس الساعة', overall: 'المتوسط العام', drop: 'محذوفة', zero: 'أصفار' }[project.d.de.missing], color: '#0891B2' },
        ]}
      />

      <Step n={1} reached={st.step} title="استكشف الطلبات حسب الساعة" instruction="جرّب الفلاتر، واضغط على العمود الأعلى لتحديد ساعة الذروة. بعدها قارن أيام العمل بنهاية الأسبوع.">
        <div className="flex flex-wrap gap-2 mb-2">
          {(['all', 'work', 'weekend'] as Filter[]).map((f) => (
            <Chip
              key={f}
              active={!compareMode && st.filter === f}
              onClick={() => {
                setCompareMode(false);
                set({ filter: f });
              }}
            >
              {filterName(f)}
            </Chip>
          ))}
          <Chip
            active={compareMode}
            onClick={() => {
              setCompareMode(true);
              set({ compared: true });
            }}
          >
            قارن: العمل مقابل نهاية الأسبوع
          </Chip>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {WEEKDAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => {
                setCompareMode(false);
                set({ filter: `d${i}` as Filter });
              }}
              aria-pressed={!compareMode && st.filter === `d${i}`}
              className={cx(
                'text-xs rounded-md px-2 py-1 border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                !compareMode && st.filter === `d${i}` ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-200 text-ink-600 hover:border-ink-400',
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="text-sm text-ink-500 mb-1">
          متوسط عدد الطلبات في الساعة — {compareMode ? 'أيام العمل (الأحد–الأربعاء) مقابل ليالي نهاية الأسبوع (الخميس–السبت)' : filterName(st.filter)}
        </div>
        <BarChart
          ariaLabel="متوسط الطلبات حسب الساعة"
          values={compareMode ? work.map((x) => x.value) : series.map((x) => x.value)}
          labels={HOURS.map((h) => String(h))}
          color={meta.color}
          onBarClick={compareMode || st.step !== 0 ? undefined : clickBar}
          compare={compareMode ? { values: weekend.map((x) => x.value), color: '#F59E0B', label: 'نهاية الأسبوع', mainLabel: 'أيام العمل' } : undefined}
        />
        <div className="flex flex-wrap gap-2 mt-3 text-sm">
          <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 border', st.peakFound ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'border-ink-200 text-ink-500')}>
            {st.peakFound ? <Icon name="check" size={14} stroke={3} /> : <Icon name="hand" size={14} />} حدّد ساعة الذروة
          </span>
          <button
            type="button"
            disabled={st.step !== 0}
            onClick={() => {
              setCompareMode(true);
              set({ compared: true });
            }}
            className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 border', st.compared ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'border-[var(--accent)] text-[var(--accent)] font-semibold hover:bg-[var(--accent-soft)]')}
          >
            {st.compared ? <Icon name="check" size={14} stroke={3} /> : <Icon name="hand" size={14} />} قارن أيام العمل بنهاية الأسبوع
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {fb && st.step === 0 && <Feedback kind={fb.kind}>{fb.text}</Feedback>}
          {compareMode && st.step === 0 && (
            <Feedback kind="info">
              لاحظ: في ذروة المساء، نهاية الأسبوع أعلى بحوالي <b>{weekendLift}%</b> من أيام العمل. نفس "الشكل" لكن بحجم مختلف.
            </Feedback>
          )}
          {st.step === 0 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={!st.peakFound || !st.compared} why={!st.peakFound ? 'اضغط على أطول عمود في الرسم' : 'باقي: اضغط «قارن: العمل مقابل نهاية الأسبوع»'} onClick={() => set({ step: 1 })} iconEnd="arrow">
                التالي: خريطة الأسبوع
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={2} skipped={skipped(2)} reached={st.step} title="اكتشف أكثر وقت ازدحامًا في الأسبوع" instruction="هذه خريطة حرارية: كل خانة = يوم × ساعة، واللون الأغمق = طلبات أكثر. اضغط على أكثر خانة ازدحامًا. (هنا كل الأيام بما فيها ليلة العيد، لذلك خانة الخميس 9 م أعلى من متوسط الخميس العادي.)">
        <Heatmap
          ariaLabel="خريطة حرارية للطلبات حسب اليوم والساعة"
          matrix={HEAT}
          rowLabels={[...WEEKDAYS]}
          colLabels={HOURS.map(String)}
          color={meta.color}
          selected={st.cell}
          onCell={st.step !== 1 ? undefined : (r, c) => {
            if (st.step !== 1) return;
            set({ cell: [r, c] });
            if (r === HEAT_MAX[0] && c === HEAT_MAX[1]) setFb({ kind: 'success', text: `وجدتها! ${WEEKDAYS[r]} الساعة ${fmtHour(HOURS[c])} بمتوسط ${HEAT[r][c]} طلب — أكثر وقت ازدحامًا في الأسبوع.` });
            else setFb({ kind: 'hint', text: `${WEEKDAYS[r]} ${fmtHour(HOURS[c])}: ${HEAT[r][c]} طلب. فيه خانة أغمق — جرّب صفوف آخر الأسبوع في المساء.` });
          }}
        />
        <div className="mt-4 space-y-3">
          {fb && st.step === 1 && <Feedback kind={fb.kind}>{fb.text}</Feedback>}
          {st.step === 1 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={!(st.cell && st.cell[0] === HEAT_MAX[0] && st.cell[1] === HEAT_MAX[1])} why="اضغط على أغمق خانة في الخريطة" onClick={() => set({ step: 2 })} iconEnd="arrow">
                التالي: الاستنتاج
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={3} reached={st.step} title="الأيام اللي طلعت عن المعتاد" instruction="كل عمود = يوم من الأسابيع الأربعة، مقارنة بنفس اليوم في أسبوع عادي. فوق الخط = أزحم من المعتاد. اضغط على أكثر يومين شذوذًا.">
        <DayDeviation
          deviation={project.deviation}
          found={st.special}
          interactive={st.step === 2}
          onDay={(d) => {
            const info = project.deviation[d];
            const label = SPECIAL_DAYS[d] ?? (PROMO_DAYS.has(d) ? 'يوم عرض ترويجي' : null);
            if (d === EID_NIGHT || d === PAYDAY_DAY) {
              if (!st.special.includes(d)) set({ special: [...st.special, d] });
              setFb({
                kind: 'success',
                text: d === EID_NIGHT ? `🎉 ${dateAr(info.date)}: ليلة عيد الأضحى! أعلى من خميس عادي بـ${info.pct}%.` : `💸 ${dateAr(info.date)}: يوم 27 — نزل الراتب! أعلى من ${WEEKDAYS[info.weekday]} عادي بـ${info.pct}%. طبيعي 😄`,
              });
            } else if (label) setFb({ kind: 'info', text: `${dateAr(info.date)}: ${label} (${info.pct > 0 ? '+' : ''}${info.pct}%). ملاحظة حلوة — لكن فيه يومين أكبر بكثير.` });
            else setFb({ kind: 'hint', text: `${dateAr(info.date)} يوم عادي (${info.pct > 0 ? '+' : ''}${info.pct}%). دوّر على أطول عمودين فوق الخط.` });
          }}
        />
        <div className="mt-4 space-y-3">
          {fb && st.step === 2 && <Feedback kind={fb.kind}>{fb.text}</Feedback>}
          {st.step === 2 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-500 tabular-nums">وجدت {st.special.length} من 2</span>
              <Button variant="accent" disabled={st.special.length < 2} why={`لقيت ${st.special.length} من 2 — دوّر على أطول عمودين فوق الخط`} onClick={() => set({ step: 3 })} iconEnd="arrow">
                التالي: الاستنتاج
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={4} reached={st.step} title="اختر الاستنتاج اللي تدعمه البيانات" instruction="محلل البيانات ما يقول رأيه — يقول اللي تثبته الأرقام. أي جملة تقدر تدافع عنها بالرسوم اللي شفتها؟">
        <div className="space-y-2.5">
          {conclusions.map((c) => (
            <OptionCard
              key={c.k}
              selected={st.concl === c.k}
              state={st.concl === c.k ? (c.k === 'right' ? 'right' : 'wrong') : null}
              disabled={st.step !== 3}
              onClick={() => set({ concl: c.k })}
            >
              <span className="text-[15px]">{c.t}</span>
            </OptionCard>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {st.concl && (st.concl === 'right' || st.concl === 'promo') ? (
            <Impact tier={conclusionTier(st.concl)} title={st.concl === 'right' ? 'استنتاج تدعمه الأرقام' : 'استنتاج فيه ادعاء سبب'}>
              {conclusions.find((c) => c.k === st.concl)!.fb.text}
            </Impact>
          ) : (
            st.concl && <Feedback kind="hint">{conclusions.find((c) => c.k === st.concl)!.fb.text}</Feedback>
          )}
          <Feedback kind="info" title="نمط أم سبب؟">
            المحلل يصف <b>متى</b> و<b>كم</b>. أما <b>ليش</b> فيحتاج اختبار — مثل مقارنة أيام فيها عرض بأيام بدون عرض في نفس اليوم والساعة. هذا شغل المحطة الجاية.
          </Feedback>
          <GovTip>{meta.govNote}</GovTip>
          {st.step === 3 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={st.concl !== 'right' && st.concl !== 'promo'} why="اختر استنتاجًا يناسب الرسوم" onClick={() => set({ step: 4 })} iconEnd="arrow">
                اكتب التقرير
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={5} reached={st.step} title="تقرير الرؤى" instruction="جمعنا اكتشافاتك في تقرير قصير — هذا اللي يستلمه الفريق والإدارة.">
        <InsightReport STATS={STATS} deviation={project.deviation} rows={DATA.length} claim={st.concl === 'promo'} />
        {st.step === 4 && (
          <div className="flex justify-end mt-4">
            <Button variant="accent" onClick={() => set({ step: 5 })} iconEnd="arrow">
              اعتمد التقرير
            </Button>
          </div>
        )}
      </Step>

      {st.step >= 5 && (
        <StationOutro
          meta={meta}
          onContinue={finish}
          nextLabel={nextLabelFor('da')}
          output={
            <div>
              <div className="text-2xl font-bold mb-3">تقرير أوقات الذروة وأنماط الطلب</div>
              <ul className="space-y-1.5 text-white/90">
                <li>• الذروة الرئيسية: {hourLabelAr(STATS.peak.hour)} ({STATS.peak.value} طلب/ساعة في المتوسط)</li>
                <li>
                  • أكثر الأيام ازدحامًا: {WEEKDAYS[TOP_DAYS[0]]} ثم {WEEKDAYS[TOP_DAYS[1]]}
                </li>
                <li>• ذروة ثانوية وقت الغداء: {hourLabelAr(STATS.lunch.hour)}</li>
                <li>• أيام استثنائية: ليلة العيد (+{project.deviation[EID_NIGHT].pct}%) ويوم الراتب 27 (+{project.deviation[PAYDAY_DAY].pct}%)</li>
                {st.concl === 'promo' && <li>• ⚠ يتضمن ادعاء: «العروض سبب زحمة الخميس» (غير مثبت)</li>}
              </ul>
              <p className="mt-3 text-white/80 text-sm">→ عالم البيانات بيسأل: هل نقدر نعرف هالأيام مسبقًا ونستخدمها للتنبؤ؟</p>
            </div>
          }
        />
      )}
    </StationShell>
  );
}

function InsightReport({ STATS, deviation, rows, claim }: { STATS: Stats; deviation: ReturnType<typeof dayDeviation>; rows: number; claim: boolean }) {
  const DAY_DEVIATION = deviation;
  return (
    <div className="rounded-xl border border-ink-200 p-5 bg-gradient-to-b from-white to-ink-50">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-ink-500">DataBite · تقرير تحليلي</div>
          <div className="font-bold text-lg">متى يزدحم المطعم؟</div>
        </div>
        <En>{`4 weeks · ${rows} rows`}</En>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="ساعة الذروة" value={fmtHour(STATS.peak.hour)} sub={`${STATS.peak.value} طلب/ساعة`} color={meta.color} />
        <Stat label="أكثر يوم" value={WEEKDAYS[STATS.busiestDay]} sub={`${Math.round(STATS.byWeekday[STATS.busiestDay])} طلب/يوم`} />
        <Stat label="ذروة الغداء" value={fmtHour(STATS.lunch.hour)} sub={`${STATS.lunch.value} طلب/ساعة`} />
        <Stat label="أهدأ وقت" value={fmtHour(STATS.quiet.hour)} sub={`${STATS.quiet.value} طلب/ساعة`} />
      </div>
      <ul className="mt-4 space-y-2 text-[15px] text-ink-700">
        <li className="flex gap-2">
          <Icon name="bulb" size={18} className="shrink-0 mt-0.5 text-amber-500" />
          الطلب ليس ثابتًا: الساعة {fmtHour(STATS.peak.hour)} أعلى بـ{Math.round(STATS.peak.value / STATS.quiet.value)} أضعاف تقريبًا من {fmtHour(STATS.quiet.hour)}.
        </li>
        <li className="flex gap-2">
          <Icon name="bulb" size={18} className="shrink-0 mt-0.5 text-amber-500" />
          متوسط الطلبات اليومية {STATS.avgDaily} طلب، و{Math.round(STATS.deliveryShare * 100)}% منها توصيل.
        </li>
        <li className="flex gap-2">
          <Icon name="bulb" size={18} className="shrink-0 mt-0.5 text-amber-500" />
          ليلة العيد أعلى بـ{DAY_DEVIATION[EID_NIGHT].pct}% من خميس عادي، ويوم 27 (الراتب) أعلى بـ{DAY_DEVIATION[PAYDAY_DAY].pct}% من ثلاثاء عادي.
        </li>
        <li className="flex gap-2">
          <Icon name="bulb" size={18} className="shrink-0 mt-0.5 text-amber-500" />
          سؤال مفتوح للفريق: هل نقدر نعرف هالأيام مسبقًا ونستخدمها للتنبؤ؟ (للتحقيق في محطة علم البيانات)
        </li>
        {claim && (
          <li className="flex gap-2 text-amber-800">
            <Icon name="bulb" size={18} className="shrink-0 mt-0.5" />
            استنتاج: العروض الترويجية سبب ازدحام ليلة الخميس. (ملاحظة: لم يُختبر)
          </li>
        )}
      </ul>
    </div>
  );
}

function DayDeviation({ deviation: DAY_DEVIATION, found, interactive, onDay }: { deviation: ReturnType<typeof dayDeviation>; found: number[]; interactive: boolean; onDay: (d: number) => void }) {
  const max = Math.max(...DAY_DEVIATION.map((d) => Math.abs(d.pct)));
  return (
    <div className="rounded-xl border border-ink-200 p-3 overflow-x-auto">
      <div className="flex items-stretch gap-[3px] min-w-[560px] h-56" dir="ltr" role="group" aria-label="انحراف كل يوم عن المعتاد">
        {DAY_DEVIATION.map((d) => {
          const h = (Math.abs(d.pct) / max) * 50;
          const isFound = found.includes(d.day);
          const color = isFound ? '#16A34A' : d.pct > 0 ? 'var(--accent)' : '#B9C0DA';
          return (
            <button
              key={d.day}
              disabled={!interactive}
              onClick={() => onDay(d.day)}
              className="relative flex-1 flex flex-col rounded-md hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-default"
              aria-label={`${dateAr(d.date)}: ${d.pct}%`}
            >
              <div className="flex-1 flex flex-col justify-end">
                {d.pct > 0 && <div className="rounded-t-sm transition-all" style={{ height: `${h}%`, background: color, minHeight: 2 }} />}
              </div>
              <div className="h-px bg-ink-400" />
              <div className="flex-1">{d.pct < 0 && <div className="rounded-b-sm" style={{ height: `${h}%`, background: color }} />}</div>
              <div className={cx('text-[10px] tabular-nums text-center mt-0.5', d.date.endsWith('-27') ? 'font-bold text-ink-900' : 'text-ink-400')}>{Number(d.date.slice(8))}</div>
              {isFound && <div className="absolute -top-1 inset-x-0 text-center text-xs">{d.day === EID_NIGHT ? '🎉' : '💸'}</div>}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-ink-500 mt-1 px-1" dir="ltr">
        <span>مايو 2025</span>
        <span>يونيو 2025</span>
      </div>
    </div>
  );
}
