import { useEffect, useMemo, useState } from 'react';
import { stationById } from './stations';
import { HOURS, Stats, HourRecord, avgByHour, dateAr, mean, round1 } from './dataset';
import { BEST_FEATURES, runModel, realInputs } from './model';
import { Approach as PApproach, FEATURE_AR, computeProject, decisionsFrom, effectiveFeatures, featuresTier, useProject } from './project';
import { Impact } from './Decision';
import { Consequence } from './Consequence';
import { FeatureId } from './model';
import { useStationState, useStore } from './store';
import { Step, StationOutro, StationShell, nextAfter, nextLabelFor, useFastSkip } from './Shell';
import { Button, Chip, Feedback, FeedbackKind, GovTip, OptionCard, cx, En } from './ui';
import { BarChart, LineChart, Scatter } from './charts';
import { Icon } from './Icon';

const meta = stationById('ds');

type Q = 'vague' | 'right' | 'why' | 'past';
type VarId = 'hour' | 'weekday' | 'promo' | 'event' | 'eid' | 'payday' | 'temperature' | 'staff';
const VARS: { id: VarId; ar: string; en: string; strength: 'قوية' | 'متوسطة' | 'ضعيفة' | 'قوية جدًا ⚠' }[] = [
  { id: 'hour', ar: 'الساعة', en: 'hour', strength: 'قوية' },
  { id: 'weekday', ar: 'يوم الأسبوع', en: 'weekday', strength: 'متوسطة' },
  { id: 'eid', ar: 'ليلة العيد', en: 'eid', strength: 'قوية' },
  { id: 'payday', ar: 'يوم الراتب (27)', en: 'payday', strength: 'قوية' },
  { id: 'promo', ar: 'عرض ترويجي', en: 'promo', strength: 'متوسطة' },
  { id: 'event', ar: 'فعالية على الكورنيش', en: 'event', strength: 'قوية' },
  { id: 'temperature', ar: 'درجة الحرارة', en: 'temperature', strength: 'ضعيفة' },
  { id: 'staff', ar: 'عدد الموظفين في الوردية', en: 'staff_on_shift', strength: 'قوية جدًا ⚠' },
];
const FEATURE_CHOICES: { id: FeatureId; ar: string }[] = [
  { id: 'hour', ar: 'الساعة' },
  { id: 'weekday', ar: 'يوم الأسبوع' },
  { id: 'eid', ar: 'ليلة العيد' },
  { id: 'payday', ar: 'يوم الراتب' },
  { id: 'promo', ar: 'عرض ترويجي' },
  { id: 'event', ar: 'فعالية الكورنيش' },
  { id: 'temperature', ar: 'درجة الحرارة' },
  { id: 'staff', ar: 'عدد الموظفين' },
  { id: 'orderId', ar: 'رقم السجل (ID)' },
];
type Approach = 'overall' | 'hourly' | 'combined';
const SAMPLE_DAY = 18; // Thursday 5 June 2025 — the night before Eid al-Adha (inside the exploration data)

export function DataScience() {
  const { state, dispatch, go } = useStore();
  const project = useProject();
  const DATA = project.clean.rows;
  const STATS = project.stats;
  const TRAIN_ROWS = DATA.filter((r) => r.week <= 3);
  const [st, set] = useStationState('ds', {
    step: 0,
    q: null as Q | null,
    opened: [] as VarId[],
    active: null as VarId | null,
    causal: null as 'yes' | 'no' | null,
    features: [] as FeatureId[],
    featureOk: false,
    featuresDone: false,
    approach: null as Approach | null,
  });
  const [fb, setFb] = useState<{ kind: FeedbackKind; text: string } | null>(null);
  useEffect(() => setFb(null), [st.step]);
  const skipped = useFastSkip(st, set, { 0: { q: 'right' }, 1: { opened: VARS.map((v) => v.id), active: 'eid' }, 4: { approach: 'combined' } });
  const [oops, setOops] = useState<null | 'leak' | 'flat'>(null);

  const qs: { k: Q; t: string; fb: { kind: FeedbackKind; text: string } }[] = [
    { k: 'vague', t: 'هل مطعم DataBite ناجح؟', fb: { kind: 'hint', text: 'سؤال مهم، لكنه واسع جدًا — "ناجح" بأي مقياس؟ نحتاج سؤالًا له رقم واضح نقدر نتوقعه.' } },
    { k: 'past', t: 'كم طلب جانا يوم الخميس الماضي؟', fb: { kind: 'hint', text: 'هذا سؤال عن الماضي — جوابه موجود في البيانات مباشرة (شغل المحلل). احنا نبي نتوقع المستقبل.' } },
    { k: 'why', t: 'ليش العملاء يحبون مطعم DataBite؟', fb: { kind: 'hint', text: 'سؤال ممتع، لكن بياناتنا ما فيها آراء العملاء. لازم السؤال يناسب البيانات المتوفرة.' } },
    { k: 'right', t: 'كم طلب نتوقع في كل ساعة لأي يوم قادم — قبلها بأسبوع؟', fb: { kind: 'success', text: 'ممتاز! سؤال واضح وقابل للقياس: نتوقع رقمًا (عدد الطلبات)، لوحدة محددة (الساعة)، وبوقت كافٍ لتجهيز الورديات.' } },
  ];

  const features = st.features;
  const toggleFeature = (f: FeatureId) => set({ features: features.includes(f) ? features.filter((x) => x !== f) : [...features, f], featureOk: false, featuresDone: false });
  // real preview: train a model on the participant's data with exactly these features
  const preview = features.length ? runModel(DATA, project.d.de.missing, features, 'honest') : null;
  const bestRun = runModel(DATA, project.d.de.missing, BEST_FEATURES, 'honest');
  const eidPeak = (m: typeof bestRun) => Math.round(Math.max(...HOURS.map((h) => m.model.predict(realInputs({ weekday: 4, hour: h, promo: false, event: false, eid: h >= 18 })))));
  const fTier = featuresTier({ features, approach: 'combined' });
  const accept = () => {
    set({ featureOk: true, featuresDone: true });
    if (features.includes('staff')) setOops('leak');
  };
  const leakProject = computeProject({ ...decisionsFrom(state), ds: { features: [...BEST_FEATURES, 'staff'], approach: 'combined' } });
  const flatProject = computeProject({ ...decisionsFrom(state), ds: { features: BEST_FEATURES, approach: 'overall' } });
  const validateFeatures = () => {
    if (features.includes('staff'))
      return setFb({ kind: 'hint', text: 'عدد الموظفين ما نعرفه قبل أسبوع — المدير يحدده بناءً على الزحمة المتوقعة. استخدامه يعني "نغش" من المستقبل (تسرّب البيانات Data Leakage). شيله.' });
    if (features.includes('orderId')) return setFb({ kind: 'hint', text: 'رقم السجل مجرد معرّف للترتيب — ما له علاقة بالزحمة. أي نمط فيه بيكون صدفة.' });
    if (!features.includes('hour')) return setFb({ kind: 'hint', text: `الساعة أقوى عامل شفناه: الفرق بين 4 العصر و9 المساء كبير جدًا. لازم تكون موجودة.` });
    if (!features.includes('weekday')) return setFb({ kind: 'hint', text: 'يوم الأسبوع يفرق: الخميس والجمعة أعلى بوضوح من الاثنين. أضفه.' });
    if (!features.includes('eid')) return setFb({ kind: 'hint', text: `ليلة العيد رفعت الطلبات بحوالي ${STATS.eidLift}% — وموعد العيد معروف مسبقًا. لازم تنضاف.` });
    if (!features.includes('payday')) return setFb({ kind: 'hint', text: `يوم 27 (الراتب) أعلى بحوالي ${STATS.paydayLift}% — وتاريخه ثابت كل شهر. أضفه.` });
    if (!features.includes('event')) return setFb({ kind: 'hint', text: `فعاليات الكورنيش ترفع طلبات المساء بحوالي ${STATS.eventLift}% — ومواعيدها تُعلن مسبقًا. تستاهل تنضاف.` });
    if (!features.includes('promo')) return setFb({ kind: 'hint', text: `أيام العروض أعلى بحوالي ${STATS.promoLift}% مقارنة بنفس اليوم والساعة بدون عرض — والعروض مخطط لها مسبقًا. أضفها.` });
    setFb({
      kind: 'success',
      text: features.includes('temperature')
        ? 'اختيار سليم. أبقيت الحرارة — علاقتها ضعيفة، والنموذج بيعطيها وزنًا صغيرًا. مهندس تعلم الآلة يقدر يتأكد هل تفيد فعلًا.'
        : 'اختيار ممتاز: عوامل نعرفها مسبقًا ولها علاقة واضحة بالطلب. واستبعدت الحرارة الضعيفة والعوامل المضللة.',
    });
  };

  const sample = useMemo(() => DATA.filter((r) => r.day === SAMPLE_DAY), [DATA]);
  const approachPred = (a: Approach) => {
    if (a === 'overall') {
      const m = round1(mean(TRAIN_ROWS.map((r) => r.orders)));
      return sample.map(() => m);
    }
    if (a === 'hourly') {
      const hourly = avgByHour(TRAIN_ROWS);
      return sample.map((r) => hourly.find((h) => h.hour === r.hour)!.value);
    }
    const m = runModel(DATA, project.d.de.missing, effectiveFeatures({ features: features.length ? features : BEST_FEATURES, approach: 'combined' }), 'honest').model;
    return sample.map((r) => round1(m.predict(realInputs(r))));
  };
  const approachFb: Record<Approach, { kind: FeedbackKind; text: string }> = {
    overall: { kind: 'hint', text: 'خط مستقيم! يتوقع نفس الرقم لكل ساعة — يفوّت ذروة المساء تمامًا.' },
    hourly: { kind: 'hint', text: 'أحسن بكثير: يعرف أن المساء أزحم. لكنه ما يعرف أن هذا الخميس ليلة العيد — لاحظ الفجوة الكبيرة في ساعات المساء. تقدر تعتمده، لكن بيكلفك في المناسبات.' },
    combined: { kind: 'success', text: 'هذا يجمع الساعة واليوم والعيد والراتب والعروض والفعاليات — لذلك يقترب من الواقع حتى في ليلة العيد. هذا المنهج اللي بنسلمه لمهندس تعلم الآلة.' },
  };

  const finish = () => {
    dispatch({ type: 'complete', id: 'ds', output: { features, approach: 'combined' } });
    go(nextAfter('ds'));
  };

  const active = st.active;

  return (
    <StationShell meta={meta}>
      <div className="rounded-2xl bg-white border border-ink-200 p-4 flex gap-3 items-start text-[15px]">
        <span className="shrink-0 mt-0.5" style={{ color: meta.color }}>
          <Icon name="chart" />
        </span>
        <p className="text-ink-700">
          من تقرير المحلل عرفنا <b>متى</b> يزدحم المطعم ({DATA.length} سجل من محطتك الأولى). عالم البيانات يسأل: <b>وش العوامل</b> اللي تخلينا نتوقع الزحمة قبل ما تصير؟ ومن اليوم في بالنا سؤال المحلل المفتوح: ليش بعض الأيام أعلى من المعتاد؟
        </p>
      </div>

      <Step n={1} skipped={skipped(1)} reached={st.step} title="صِغ المشكلة" instruction="صاحبة المطعم تقول: «أبي أعرف الزحمة قبل ما تصير». أي سؤال يحوّل طلبها لمشكلة نقدر نحلها بالبيانات؟">
        <div className="space-y-2.5">
          {qs.map((q) => (
            <OptionCard key={q.k} selected={st.q === q.k} state={st.q === q.k ? (q.k === 'right' ? 'right' : 'wrong') : null} disabled={st.step !== 0} onClick={() => set({ q: q.k })}>
              {q.t}
            </OptionCard>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {st.q && <Feedback kind={qs.find((q) => q.k === st.q)!.fb.kind}>{qs.find((q) => q.k === st.q)!.fb.text}</Feedback>}
          {st.q === 'right' && (
            <div className="grid sm:grid-cols-3 gap-2.5 animate-rise">
              {[
                ['الهدف', 'Target', 'عدد الطلبات'],
                ['الوحدة', 'Granularity', 'كل ساعة'],
                ['متى نتوقع', 'Horizon', 'قبل أسبوع'],
              ].map(([a, e, v]) => (
                <div key={a} className="rounded-xl bg-[var(--accent-soft)] px-4 py-3">
                  <div className="text-xs text-ink-500">
                    {a} <En>{e}</En>
                  </div>
                  <div className="font-bold mt-1">{v}</div>
                </div>
              ))}
            </div>
          )}
          {st.step === 0 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={st.q !== 'right'} onClick={() => set({ step: 1 })} iconEnd="arrow">
                التالي: افحص العوامل
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={2} skipped={skipped(2)} reached={st.step} title="افحص العوامل المحتملة" instruction={`اضغط على كل عامل لترى علاقته بعدد الطلبات. افحص العوامل ${VARS.length}.`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {VARS.map((v) => {
            const seen = st.opened.includes(v.id);
            return (
              <button
                key={v.id}
                onClick={() => set({ active: v.id, opened: seen ? st.opened : [...st.opened, v.id] })}
                aria-pressed={active === v.id}
                className={cx(
                  'text-right rounded-xl border-2 px-3.5 py-3 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/25',
                  active === v.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-ink-200 bg-white hover:border-ink-400',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{v.ar}</span>
                  {seen && <Icon name="check" size={16} className="text-emerald-600" stroke={3} />}
                </div>
                <bdi dir="ltr" className="text-xs font-mono text-ink-500">
                  {v.en}
                </bdi>
                {seen && <div className="text-xs mt-1 text-ink-600">علاقة: {v.strength}</div>}
              </button>
            );
          })}
        </div>
        {active && (
          <div className="mt-4 rounded-xl border border-ink-200 p-4 animate-rise" key={active}>
            <VariableView id={active} DATA={DATA} STATS={STATS} />
          </div>
        )}
        {st.step === 1 && (
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-ink-500 tabular-nums">فحصت {st.opened.length} من {VARS.length}</span>
            <Button variant="accent" disabled={st.opened.length < VARS.length} onClick={() => set({ step: 2 })} iconEnd="arrow">
              التالي
            </Button>
          </div>
        )}
      </Step>

      <Step n={3} reached={st.step} title="ارتباط… أم سبب؟" instruction={`عدد الموظفين مرتبط بقوة شديدة بعدد الطلبات (معامل الارتباط ${STATS.corrStaff.toFixed(2)}). هل معنى هذا أننا لو زدنا الموظفين بتزيد الطلبات؟`}>
        <div className="grid sm:grid-cols-2 gap-3">
          <OptionCard selected={st.causal === 'yes'} state={st.causal === 'yes' ? 'wrong' : null} disabled={st.step !== 2} onClick={() => set({ causal: 'yes' })}>
            <div className="font-bold">نعم، نزيد الموظفين وتزيد الطلبات</div>
            <div className="text-sm text-ink-500 mt-0.5">الارتباط قوي جدًا، يعني فيه سبب.</div>
          </OptionCard>
          <OptionCard selected={st.causal === 'no'} state={st.causal === 'no' ? 'right' : null} disabled={st.step !== 2} onClick={() => set({ causal: 'no' })}>
            <div className="font-bold">لا، العلاقة غالبًا بالعكس</div>
            <div className="text-sm text-ink-500 mt-0.5">المدير يزيد الموظفين لأنه يتوقع الزحمة.</div>
          </OptionCard>
        </div>
        <div className="mt-4 space-y-3">
          {st.causal === 'yes' && (
            <Feedback kind="hint">
              فكّر فيها: لو جبنا 10 موظفين يوم الاثنين الهادئ، هل بيجي عملاء أكثر؟ غالبًا لا. الارتباط القوي ما يعني أن الأول يسبب الثاني. جرّب الخيار الثاني.
            </Feedback>
          )}
          {st.causal === 'no' && (
            <Feedback kind="success" title="الارتباط ليس بالضرورة سببية">
              الطلبات المتوقعة هي اللي "تسبب" عدد الموظفين — مو العكس. والأهم: ما نعرف عدد الموظفين قبل أسبوع، فما نقدر نستخدمه للتنبؤ أصلًا. نفس الشي مع الحرارة: الارتباط ضعيف ({STATS.corrTemp.toFixed(2)}) وسببه غالبًا أن العصر أحر وأهدأ في نفس الوقت.
            </Feedback>
          )}
          {st.step === 2 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={st.causal !== 'no'} onClick={() => set({ step: 3 })} iconEnd="arrow">
                التالي: اختر الخصائص
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={4} reached={st.step} title="اختر خصائص النموذج" instruction={<>الخصائص <En>Features</En> هي المعلومات اللي بيستخدمها النموذج للتنبؤ. اختر العوامل المفيدة اللي نعرفها <b>قبل</b> الموعد بأسبوع، ثم اضغط «تحقق».</>}>
        <div className="flex flex-wrap gap-2">
          {FEATURE_CHOICES.map((f) => (
            <Chip key={f.id} active={features.includes(f.id)} disabled={st.step !== 3} onClick={() => toggleFeature(f.id)}>
              {features.includes(f.id) ? '✓ ' : '+ '}
              {f.ar}
            </Chip>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {fb && st.step === 3 && <Feedback kind={fb.kind}>{fb.text}</Feedback>}
          {preview && (
            <div className="rounded-xl border border-ink-200 p-4">
              <div className="text-sm font-bold mb-2">معاينة حقيقية: نموذج مبدئي بخصائصك (محسوب الآن على بياناتك)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-ink-50 p-2">
                  <div className="text-[11px] text-ink-500">معلومات يشوفها النموذج</div>
                  <div className="font-bold tabular-nums">{features.length}</div>
                </div>
                <div className="rounded-lg bg-ink-50 p-2">
                  <div className="text-[11px] text-ink-500">خطأ في الاختبار</div>
                  <div className="font-bold tabular-nums">±{preview.ev.mae.toFixed(1)}</div>
                </div>
                <div className={cx('rounded-lg p-2', preview.ev.realMae > preview.ev.mae + 0.4 ? 'bg-rose-50' : 'bg-ink-50')}>
                  <div className="text-[11px] text-ink-500">خطأ على أسبوع جديد</div>
                  <div className="font-bold tabular-nums">±{preview.ev.realMae.toFixed(1)}</div>
                </div>
                <div className="rounded-lg bg-ink-50 p-2">
                  <div className="text-[11px] text-ink-500">ذروة ليلة العيد المتوقعة</div>
                  <div className="font-bold tabular-nums">{eidPeak(preview)} <span className="text-ink-400 font-normal text-xs">/ {eidPeak(bestRun)} بأفضل خصائص</span></div>
                </div>
              </div>
            </div>
          )}
          {st.featuresDone && (
            <Impact tier={fTier} title={fTier === 'best' ? 'خصائص نعرفها مسبقًا ولها علاقة واضحة' : fTier === 'cost' ? 'خصائص مقبولة لكن ناقصة أو فيها ضجيج' : 'خاصية مسرّبة داخل النموذج'}>
              {fTier === 'best'
                ? 'النموذج يشوف كل المعلومات المفيدة اللي نعرفها قبل أسبوع، وما يشوف شي مضلّل.'
                : fTier === 'cost'
                ? `${BEST_FEATURES.filter((f) => !features.includes(f)).length ? `ناقص: ${BEST_FEATURES.filter((f) => !features.includes(f)).map((f) => FEATURE_AR[f]).join('، ')}. ` : ''}${features.filter((f) => f === 'temperature' || f === 'orderId').length ? `ضجيج: ${features.filter((f) => f === 'temperature' || f === 'orderId').map((f) => FEATURE_AR[f]).join('، ')}. ` : ''}الأثر محسوب في المعاينة فوق، وبيمشي للنموذج ولوحة الإدارة.`
                : `عدد الموظفين يخلي الاختبار يطلع ممتاز (±${leakProject.run.ev.mae.toFixed(1)}) لكن في الاستخدام الحقيقي ما نعرفه مسبقًا، فالخطأ يصير ±${leakProject.run.ev.realMae.toFixed(1)}.`}
            </Impact>
          )}
          <GovTip>{meta.govNote}</GovTip>
          {st.step === 3 && (
            <div className="flex justify-end gap-2 flex-wrap">
              <Button variant="secondary" disabled={!features.length} onClick={validateFeatures}>
                تلميح: راجع اختياري
              </Button>
              {!st.featuresDone ? (
                <Button variant="accent" disabled={!features.length} onClick={accept}>
                  اعتمد الخصائص
                </Button>
              ) : (
                <Button variant="accent" onClick={() => set({ step: 4 })} iconEnd="arrow">
                  التالي
                </Button>
              )}
            </div>
          )}
        </div>
      </Step>

      <Step n={5} skipped={skipped(5)} reached={st.step} title="قارن مناهج التنبؤ" instruction={`جرّب كل منهج على يوم من بيانات الاستكشاف: الخميس ${dateAr(sample[0].date)} — ليلة عيد الأضحى. أي منهج يقترب أكثر من الواقع؟`}>
        <div className="grid sm:grid-cols-3 gap-3">
          {(
            [
              ['overall', 'المتوسط العام', 'نتوقع نفس المتوسط لكل ساعة.'],
              ['hourly', 'متوسط كل ساعة', 'نتوقع متوسط الساعة نفسها في الأسابيع الماضية.'],
              ['combined', 'نموذج يجمع العوامل', 'انحدار يجمع الخصائص اللي اخترتها.'],
            ] as [Approach, string, string][]
          ).map(([k, t, d]) => (
            <OptionCard
              key={k}
              selected={st.approach === k}
              state={st.approach === k ? (k === 'combined' ? 'right' : 'wrong') : null}
              disabled={st.step !== 4}
              onClick={() => {
                set({ approach: k });
                if (k === 'overall') setOops('flat');
              }}
            >
              <div className="font-bold">{t}</div>
              <div className="text-sm text-ink-500 mt-0.5">{d}</div>
            </OptionCard>
          ))}
        </div>
        {st.approach && (
          <div className="mt-4 animate-rise" key={st.approach}>
            <LineChart
              ariaLabel="مقارنة التوقع بالواقع"
              labels={HOURS.map(String)}
              series={[
                { name: 'الواقع', values: sample.map((r) => r.orders), color: '#111833' },
                { name: 'توقع المنهج', values: approachPred(st.approach), color: meta.color, dashed: true },
              ]}
            />
          </div>
        )}
        <div className="mt-4 space-y-3">
          {st.approach && <Feedback kind={approachFb[st.approach].kind}>{approachFb[st.approach].text}</Feedback>}
          {st.approach === 'combined' && (
            <Feedback kind="info" title="وين ينتهي دور عالم البيانات؟">
              عالم البيانات <b>حقق</b> في المشكلة واقترح المنهج. الحين يجي دور مهندس تعلم الآلة: <b>يبني</b> النموذج بشكل صحيح، <b>يقيّمه</b> بأمانة على بيانات ما شافها (الأسبوع الرابع)، و<b>يشغّله</b> داخل التطبيق.
            </Feedback>
          )}
          {st.step === 4 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={!st.approach} onClick={() => set({ step: 5 })} iconEnd="arrow">
                اعتمد المنهج
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Consequence
        open={!!oops}
        headline={oops === 'leak' ? 'بعد إطلاق النموذج… ليلة العيد' : 'ليلة العيد مع منهج «المتوسط العام»'}
        story={
          oops === 'leak'
            ? `في الاختبار كان ممتازًا (±${leakProject.run.ev.mae.toFixed(1)}). لكن قبل العيد بأسبوع ما نعرف كم موظف بيكون — فدخّلنا المتوسط، وتوقّع النموذج ذروة ${Math.round(Math.max(...leakProject.eidForecast))} طلب فقط. الواقع ${Math.round(Math.max(...leakProject.eidTruth))}.`
            : `المنهج يتوقع ${Math.round(Math.max(...flatProject.eidForecast))} طلب لكل ساعة — نفس الرقم الظهر وليلة العيد. الواقع في الذروة ${Math.round(Math.max(...flatProject.eidTruth))}.`
        }
        hour={21}
        orders={(oops === 'leak' ? leakProject : flatProject).eidTruth[9]}
        staff={(oops === 'leak' ? leakProject : flatProject).recommendedStaff}
        eid
        lesson={
          oops === 'leak'
            ? 'هذا تسرّب البيانات: معلومة متوفرة وقت التدريب، غير متوفرة وقت التنبؤ الحقيقي. النتيجة اختبار يطمّن ونظام يخذل.'
            : 'المنهج الأبسط من اللازم ما يقدر يتعلم أي نمط — حتى لو كانت البيانات ممتازة.'
        }
        onRewind={() => {
          if (oops === 'leak') set({ features: features.filter((f) => f !== 'staff'), featuresDone: false, featureOk: false });
          else set({ approach: null });
          setOops(null);
        }}
        onProceed={() => setOops(null)}
      />

      {st.step >= 5 && (
        <StationOutro
          meta={meta}
          onContinue={finish}
          nextLabel={nextLabelFor('ds')}
          output={
            <div>
              <div className="text-2xl font-bold mb-3">ملف المشكلة والمنهج</div>
              <div className="space-y-2 text-white/90">
                <div>
                  <b>السؤال:</b> كم طلب نتوقع في كل ساعة لأي يوم قادم؟
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <b>الخصائص:</b>
                  {features.map((f) => (
                    <span key={f} className="rounded-md bg-white/15 px-2 py-0.5 text-sm">
                      {FEATURE_CHOICES.find((c) => c.id === f)!.ar}
                    </span>
                  ))}
                </div>
                <div>
                  <b>المنهج:</b> {{ combined: 'انحدار يجمع العوامل (Regression)', hourly: 'متوسط كل ساعة (لا يعرف المناسبات)', overall: 'المتوسط العام (رقم واحد لكل الساعات)' }[(st.approach as PApproach) ?? 'combined']}
                </div>
                <div className="text-sm text-white/70">
                  {features.includes('staff') ? '⚠ يتضمن «عدد الموظفين» — تسرّب بيانات.' : 'مستبعد: عدد الموظفين (تسرّب + سببية معكوسة).'} النموذج سيرى فعليًا: {effectiveFeatures({ features, approach: (st.approach as PApproach) ?? 'combined' }).map((f) => FEATURE_AR[f]).join('، ') || 'لا شيء'}.
                </div>
              </div>
              {state.completed.ml && <p className="mt-3 text-sm text-white/70">ملاحظة: النموذج المدرّب في المحطة التالية يستخدم هذه الخصائص.</p>}
            </div>
          }
        />
      )}
    </StationShell>
  );
}

function VariableView({ id, DATA, STATS }: { id: VarId; DATA: HourRecord[]; STATS: Stats }) {
  if (id === 'hour') {
    const v = STATS.byHour;
    return (
      <>
        <p className="text-sm text-ink-600 mb-2">متوسط الطلبات لكل ساعة — الفرق كبير جدًا بين الساعات.</p>
        <BarChart ariaLabel="الطلبات حسب الساعة" values={v.map((x) => x.value)} labels={v.map((x) => String(x.hour))} color={meta.color} height={180} />
      </>
    );
  }
  if (id === 'weekday') {
    return (
      <>
        <p className="text-sm text-ink-600 mb-2">متوسط إجمالي الطلبات اليومية لكل يوم.</p>
        <BarChart ariaLabel="الطلبات حسب اليوم" values={STATS.byWeekday.map(Math.round)} labels={['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']} color={meta.color} height={180} showValues />
      </>
    );
  }
  if (id === 'promo' || id === 'event' || id === 'eid' || id === 'payday') {
    const lift = { promo: STATS.promoLift, event: STATS.eventLift, eid: STATS.eidLift, payday: STATS.paydayLift }[id];
    return (
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="text-center sm:w-40 shrink-0">
          <div className="text-4xl font-bold" style={{ color: meta.color }}>
            +{lift}%
          </div>
          <div className="text-sm text-ink-500">زيادة في الطلبات</div>
        </div>
        <p className="text-[15px] text-ink-700">
          {{
            promo: 'قارنّا كل ساعة فيها عرض بنفس اليوم ونفس الساعة في أسابيع بدون عرض — مقارنة عادلة. العروض ترفع الطلب، ومواعيدها معروفة مسبقًا.',
            event: 'في أمسيات فعاليات الكورنيش يرتفع الطلب بوضوح (من 7 مساءً). وجدول الفعاليات يُعلن مسبقًا.',
            eid: 'ليلة العيد ويومه: الناس تطلع وتتعشى برا. أكبر قفزة في البيانات — وموعد العيد معروف قبلها بأسابيع. هذا جواب سؤال المحلل!',
            payday: 'يوم 27 تنزل الرواتب، والناس تكافئ نفسها 😄. الطلب أعلى طول اليوم — والتاريخ ثابت كل شهر.',
          }[id]}
        </p>
      </div>
    );
  }
  if (id === 'temperature') {
    return (
      <div className="grid sm:grid-cols-[1fr_1.2fr] gap-4 items-center">
        <Scatter ariaLabel="الحرارة مقابل الطلبات" points={DATA.map((r) => [r.temperature, r.orders])} color={meta.color} xLabel="°C" yLabel="orders" />
        <p className="text-[15px] text-ink-700">
          النقاط مبعثرة بدون اتجاه واضح — علاقة <b>ضعيفة</b> (الارتباط {STATS.corrTemp.toFixed(2)}). مو كل متغير متوفر يكون مفيدًا.
        </p>
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-[1fr_1.2fr] gap-4 items-center">
      <Scatter ariaLabel="عدد الموظفين مقابل الطلبات" points={DATA.map((r) => [r.staff, r.orders])} color="#E11D48" xLabel="staff" yLabel="orders" />
      <p className="text-[15px] text-ink-700">
        خط شبه مستقيم! ارتباط <b>قوي جدًا</b> ({STATS.corrStaff.toFixed(2)}). يبدو مثاليًا للتنبؤ… لكن فيه شي مريب. بنرجع له بعد شوي.
      </p>
    </div>
  );
}
