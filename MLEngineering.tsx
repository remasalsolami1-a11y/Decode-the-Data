import { staffAr } from './sim';
import { useEffect, useMemo, useState } from 'react';
import { stationById } from './stations';
import { HOURS, WEEKDAYS, WEEKDAYS_EN, fmtHour, round1, staffFor } from './dataset';
import { CONFIG_INFO, FeatureId, TrainConfig, crowdLevel, realInputs, runModel } from './model';
import { FEATURE_AR, computeProject, configTier, decisionsFrom, useProject } from './project';
import { Impact, Inputs } from './Decision';
import { Consequence } from './Consequence';
import { useStationState, useStore } from './store';
import { Step, StationOutro, StationShell, nextAfter, nextLabelFor, useFastSkip } from './Shell';
import { LiveRestaurant } from './LiveRestaurant';
import { Button, Chip, Feedback, FeedbackKind, GovTip, OptionCard, SimLabel, Stat, cx, En } from './ui';
import { LineChart } from './charts';
import { Icon } from './Icon';

const meta = stationById('ml');
type Snip = 'a' | 'b' | 'c';

/** The features the participant's model actually uses (from station 3). */
export function useActiveFeatures(): FeatureId[] {
  return useProject().features;
}

const SNIP_CFG: Record<Snip, TrainConfig> = { a: 'same', b: 'small', c: 'honest' };

export function MLEngineering() {
  const { state, dispatch, go } = useStore();
  const project = useProject();
  const features = project.features;
  const [st, set] = useStationState('ml', {
    step: 0,
    snip: null as Snip | null,
    explain: null as Snip | null,
    trained: false,
    testDay: 25,
    wd: 4,
    hour: 21,
    promo: false,
    event: false,
    eid: false,
    payday: false,
    predicted: false,
    published: false,
  });
  const [training, setTraining] = useState<number>(-1);
  const [oops, setOops] = useState(false);
  const skipped = useFastSkip(st, set, { 2: {} });

  // the model is trained on the participant's dataset, features and chosen configuration
  const run = project.run;
  const model = run.model;
  const ev = run.ev;
  const preview = (k: Snip) => runModel(project.clean.rows, project.d.de.missing, features, SNIP_CFG[k]);
  const sameProject = useMemo(() => computeProject({ ...decisionsFrom(state), ml: { config: 'same' } }), [state]);
  const featList = features.map((f) => `"${f}"`).join(', ') || '';

  const snippets: { k: Snip; title: string; code: string; lines: string[]; fb: { kind: FeedbackKind; text: string } }[] = [
    {
      k: 'a',
      title: 'الخيار أ',
      code: `model = Memorize()\nmodel.fit(data[features], data["orders"])\nscore = model.evaluate(data)`,
      lines: ['ننشئ نموذجًا «يحفظ» كل صف كما هو', 'ندرّبه على البيانات كلها', 'نقيّمه على… نفس البيانات اللي حفظها'],
      fb: { kind: 'hint', text: '' },
    },
    {
      k: 'b',
      title: 'الخيار ب',
      code: `features = [${featList}]\ntrain, test = split(data, train="weeks 1-2")\nmodel = Regression()\nmodel.fit(train[features], train["orders"])\nscore = model.evaluate(test)`,
      lines: ['نستخدم الخصائص اللي اعتمدها عالم البيانات', 'ندرّب على أول أسبوعين فقط، ونختبر على 3–4', 'ننشئ نموذج انحدار', 'ندرّبه على أسبوعين', 'نقيّمه على أسبوعين ما شافهم'],
      fb: { kind: 'hint', text: '' },
    },
    {
      k: 'c',
      title: 'الخيار ج',
      code: `features = [${featList}]\ntrain, test = split(data, test="week 4")\nmodel = Regression()\nmodel.fit(train[features], train["orders"])\nscore = model.evaluate(test)`,
      lines: ['نستخدم الخصائص اللي اعتمدها عالم البيانات', 'نحتفظ بالأسبوع الرابع للاختبار فقط', 'ننشئ نموذج انحدار', 'ندرّبه على الأسابيع 1–3', 'نقيّمه بأمانة على أسبوع ما شافه'],
      fb: { kind: 'success', text: '' },
    },
  ];

  // training animation (the actual fit is instant — it runs in your browser)
  useEffect(() => {
    if (training < 0 || training >= 4) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setTraining((x) => x + 1), reduce ? 10 : 650);
    return () => clearTimeout(t);
  }, [training]);
  useEffect(() => {
    if (training >= 4 && !st.trained) set({ trained: true });
  }, [training, st.trained, set]);

  const testDays = [...new Set(ev.pairs.map((p) => p.r.day))];
  const testDay = testDays.includes(st.testDay) ? st.testDay : testDays[testDays.length - 3] ?? testDays[0];
  const testDayPairs = ev.pairs.filter((p) => p.r.day === testDay);
  const inputs = realInputs({ weekday: st.wd, hour: st.hour, promo: st.promo, event: st.event, eid: st.eid, payday: st.payday, day: 60 });
  const pred = round1(model.predict(inputs));
  const snipImpact = (k: Snip) => {
    const r = preview(k);
    if (k === 'a') return `هذا النموذج «يحفظ» البيانات. التقييم بيقول خطأ ±${r.ev.mae.toFixed(1)} — مثالي! لكن على أسبوع جديد ما شافه أحد: ±${r.ev.realMae.toFixed(1)}. مثل طالب حفظ أسئلة الاختبار بالضبط (Overfitting).`;
    if (k === 'b') return `تقسيم أمين، لكن بيانات أقل (${r.ev.trainRows} سجل بدل ${preview('c').ev.trainRows}). والأهم: ليلة العيد في الأسبوع الثالث — النموذج ما بيتعلم أثرها أبدًا.`;
    return `تدريب على ${r.ev.trainRows} سجل، واختبار أمين على ${r.ev.testRows} سجل ما شافها النموذج. أفضل توازن بين كمية البيانات وصدق التقييم.`;
  };
  const level = crowdLevel(pred);

  const finish = () => {
    dispatch({ type: 'complete', id: 'ml', output: { features, trained: true } });
    go(nextAfter('ml'));
  };

  return (
    <StationShell meta={meta}>
      <div className="rounded-2xl bg-white border border-ink-200 p-4 flex gap-3 items-start text-[15px]">
        <span className="shrink-0 mt-0.5" style={{ color: meta.color }}>
          <Icon name="flask" />
        </span>
        <p className="text-ink-700">
          عالم البيانات سلّمنا المنهج: انحدار <En>Regression</En> بـ <b>{features.length}</b> خصائص. دورك تبني النموذج فعليًا، تقيّمه بأمانة، وتحوّله لشي يستخدمه الناس. <b>ما راح تكتب كود</b> — بتختار طريقة التدريب وتشوف أثرها.
        </p>
      </div>

      <Inputs
        items={[
          { label: 'البيانات', value: `${project.clean.rows.length} سجل`, color: '#0891B2' },
          { label: 'الخصائص من عالم البيانات', value: features.length ? features.map((f) => FEATURE_AR[f]).join('، ') : 'لا شيء', color: '#8B5CF6' },
        ]}
      />
      <Consequence
        open={oops}
        headline="ليلة العيد مع النموذج «الحافظ»"
        story={`التقييم أعطى خطأ ±${sameProject.run.ev.mae.toFixed(1)} فوثق فيه الكل. لكن النموذج ما «فهم» شي — ينسخ آخر أسبوع شافه. توقّع ذروة ${Math.round(Math.max(...sameProject.eidForecast))} طلب ليلة العيد، والواقع ${Math.round(Math.max(...sameProject.eidTruth))}.`}
        hour={21}
        orders={sameProject.eidTruth[9]}
        staff={sameProject.recommendedStaff}
        eid
        lesson="تقييم النموذج على بيانات شافها يشبه طالب يصحح اختباره بنفسه. لازم دائمًا نختبر على بيانات جديدة."
        onRewind={() => {
          set({ snip: null, trained: false });
          setOops(false);
        }}
        onProceed={() => setOops(false)}
      />

      <Step n={1} reached={st.step} title="كيف نعلّم النموذج ونختبره؟" instruction="اختر طريقة من الثلاث. كل طريقة لها أثر حقيقي على النموذج — جرّب واقرأ النتيجة.">
        <div className="rounded-xl bg-[var(--accent-soft)] p-4 mb-4 flex gap-3 items-start">
          <span className="text-2xl" aria-hidden="true">🎓</span>
          <div className="text-[15px] leading-relaxed">
            <b>فكّر في النموذج كطالب.</b> عندنا 4 أسابيع من بيانات المطعم = 4 فصول من الكتاب.
            <br />
            <b>التدريب</b> = الطالب يذاكر من بعض الأسابيع. <b>الاختبار</b> = نسأله عن أسبوع ما ذاكره، عشان نعرف هل <b>فهم</b> فعلًا أو بس <b>حفظ</b>.
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-3">
          {snippets.map((s) => {
            const plain = PLAIN[s.k];
            return (
              <div key={s.k} className="flex flex-col">
                <OptionCard
                  selected={st.snip === s.k}
                  state={st.snip === s.k ? (s.k === 'c' ? 'right' : 'wrong') : null}
                  disabled={st.step !== 0}
                  onClick={() => {
                    set({ snip: s.k, trained: false });
                    setTraining(-1);
                    if (configTier(SNIP_CFG[s.k]) === 'harm') setOops(true);
                  }}
                >
                  <div className="text-xs font-bold text-ink-500">{s.title}</div>
                  <div className="font-bold text-[17px] leading-snug mt-0.5">
                    {plain.emoji} {plain.title}
                  </div>
                  <p className="text-sm text-ink-600 mt-1.5">{plain.student}</p>
                  <WeekStrip k={s.k} />
                </OptionCard>
                <details className="mt-1.5 group">
                  <summary className="text-sm font-semibold px-2 py-1 rounded-md hover:bg-ink-100 cursor-pointer list-none" style={{ color: meta.color }}>
                    {'</>'} شوف الكود
                  </summary>
                  <pre dir="ltr" className="mt-1 text-left text-[11.5px] leading-relaxed bg-ink-950 text-ink-100 rounded-lg p-3 whitespace-pre-wrap">
                    {s.code.split('\n').map((l, i) => (
                      <div key={i} className={cx('flex gap-2', l.includes('evaluate(data)') && 'text-rose-300')}>
                        <span className="text-ink-500 select-none shrink-0">{i + 1}</span>
                        <span className="min-w-0 [overflow-wrap:anywhere]">{l}</span>
                      </div>
                    ))}
                  </pre>
                  <ol className="text-sm text-ink-700 space-y-1 mt-1 bg-ink-50 rounded-lg p-3">
                    {s.lines.map((l, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono text-ink-400 shrink-0">{i + 1}</span>
                        {l}
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-3">
          {st.snip && (
            <Impact tier={configTier(SNIP_CFG[st.snip])} title={CONFIG_INFO[SNIP_CFG[st.snip]].ar}>
              {snipImpact(st.snip)}
            </Impact>
          )}
          {st.step === 0 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={!st.snip} why="اختر طريقة تدريب" onClick={() => set({ step: 1 })} iconEnd="arrow">
                التالي: التدريب
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={2} reached={st.step} title="درّب النموذج" instruction={`اضغط الزر. النموذج يتدرّب فعليًا الآن داخل متصفحك على ${ev.trainRows} ساعة من بياناتك (${CONFIG_INFO[run.config].trainAr}).`}>
        <div className="rounded-xl bg-ink-950 text-ink-100 p-4 font-mono text-sm min-h-[150px]" dir="ltr" aria-live="polite">
          {training < 0 && !st.trained ? (
            <div className="h-[118px] grid place-items-center">
              <Button variant="accent" size="lg" icon="play" onClick={() => setTraining(0)} disabled={st.step !== 1}>
                Train Model
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[
                `> loading ${ev.trainRows} training rows (${CONFIG_INFO[run.config].train})`,
                run.config === 'same' ? '> memorising every row…' : `> encoding features: [${features.join(', ')}]`,
                run.config === 'same' ? `> stored ${ev.trainRows} rows` : `> fitting log-linear regression (least squares)… ${model.weights.length} weights`,
                `> evaluating on ${ev.testRows} rows (${CONFIG_INFO[run.config].test})`,
                '✓ done',
              ].map((l, i) =>
                i <= Math.max(training, st.trained ? 4 : -1) ? (
                  <div key={i} className={cx('animate-rise', i === 4 && 'text-emerald-400 font-bold')}>
                    {l}
                  </div>
                ) : null,
              )}
            </div>
          )}
        </div>
        {st.trained && st.step === 1 && (
          <div className="flex justify-end mt-4">
            <Button variant="accent" onClick={() => set({ step: 2 })} iconEnd="arrow">
              شوف نتائج التقييم
            </Button>
          </div>
        )}
      </Step>

      <Step n={3} skipped={skipped(3)} reached={st.step} title="افهم نتائج التقييم" instruction={`هذه أرقام تقييمك (على ${CONFIG_INFO[run.config].testAr}). اختر يومًا لتقارن التوقع بالواقع.`}>
        <div className="mb-3">
          <SimLabel>محسوبة فعليًا في متصفحك · على بيانات DataBite التعليمية (غير حقيقية)</SimLabel>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Stat label="متوسط الخطأ في الساعة (MAE)" value={`±${ev.mae.toFixed(1)}`} sub="طلب في الساعة" color={meta.color} />
          <Stat label="توقعات قريبة (ضمن ±5 طلبات)" value={`${Math.round(ev.within5 * 100)}%`} sub={`من ${ev.testRows} ساعة اختبار`} />
          <Stat label="متوسط نسبة الخطأ" value={`${Math.round(ev.mape * 100)}%`} sub="MAPE" />
        </div>
        <div className={cx('mt-3 rounded-xl border-2 p-4 flex flex-wrap items-center gap-4', ev.realMae > ev.mae + 0.5 ? 'border-rose-300 bg-rose-50' : 'border-ink-200 bg-ink-50')}>
          <div>
            <div className="text-xs text-ink-500">اختبار إضافي: أسبوع جديد كليًا لم يره أحد (15–21 يونيو)</div>
            <div className="text-3xl font-bold tabular-nums">±{ev.realMae.toFixed(1)}</div>
          </div>
          <p className="flex-1 min-w-[220px] text-[15px] text-ink-700">
            {ev.realMae > ev.mae + 0.5
              ? `التقييم قال ±${ev.mae.toFixed(1)}، لكن على أيام جديدة الخطأ أكبر بكثير. تقييمك كان متفائلًا.`
              : 'قريب من رقم التقييم — يعني التقييم كان صادقًا ويمكن الوثوق به.'}
          </p>
        </div>
        <div className="mt-4 rounded-xl border border-ink-200 p-4">
          <div className="text-sm font-bold mb-3">مقارنة بطرق أبسط (متوسط الخطأ — الأقل أفضل)</div>
          {[
            ['المتوسط العام', ev.baselineMae, '#B9C0DA'],
            ['متوسط كل ساعة', ev.hourAvgMae, '#8A93B5'],
            ['نموذجنا', ev.mae, meta.color],
          ].map(([l, v, c]) => (
            <div key={l as string} className="flex items-center gap-3 mb-2 text-sm">
              <span className="w-28 shrink-0">{l}</span>
              <div className="flex-1 h-6 bg-ink-50 rounded-md overflow-hidden">
                <div className="h-full rounded-md transition-all duration-700" style={{ width: `${((v as number) / ev.baselineMae) * 100}%`, background: c as string }} />
              </div>
              <span className="w-12 tabular-nums font-bold">±{(v as number).toFixed(1)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {testDays.slice(-7).map((d) => {
              const r = ev.pairs.find((x) => x.r.day === d)!.r;
              return (
                <Chip key={d} active={testDay === d} onClick={() => set({ testDay: d })}>
                  {WEEKDAYS[r.weekday]}
                  {r.promo ? ' · عرض' : ''}
                  {ev.pairs.some((x) => x.r.day === d && x.r.event) ? ' · فعالية' : ''}
                </Chip>
              );
            })}
          </div>
          <LineChart
            ariaLabel="التوقع مقابل الواقع"
            labels={HOURS.map(String)}
            series={[
              { name: 'الواقع', values: testDayPairs.map((p) => p.r.orders), color: '#111833' },
              { name: 'توقع النموذج', values: testDayPairs.map((p) => round1(p.pred)), color: meta.color, dashed: true },
            ]}
          />
        </div>
        <div className="mt-4 space-y-3">
          <Feedback kind="info">
            معنى النتيجة: لو النموذج قال «40 طلب الساعة 9»، الواقع غالبًا بين {Math.round(40 - ev.realMae)} و{Math.round(40 + ev.realMae)}. مفيد للتخطيط — لكنه <b>تقدير</b> وليس ضمانًا.
          </Feedback>
          <details className="rounded-xl border border-ink-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold">حدود هذا النموذج (اقرأها قبل ما تثق فيه)</summary>
            <ul className="mt-2 space-y-1 text-[15px] text-ink-700 list-disc ps-5">
              <li>يعرف فقط ما رآه: {features.length ? features.map((f) => FEATURE_AR[f]).join('، ') : 'لا شيء — يتوقع رقمًا ثابتًا'}.</li>
              <li>أي حدث جديد ما في البيانات (رمضان، افتتاح فرع، إغلاق شارع) بيخطئ فيه.</li>
              <li>تدرّب على {ev.trainRows} ساعة فقط من فرع واحد — بيانات قليلة.</li>
              <li>جودة النموذج = جودة البيانات اللي جات من محطة التنظيف.</li>
            </ul>
          </details>
          {st.step === 2 && (
            <div className="flex justify-end">
              <Button variant="accent" onClick={() => set({ step: 3 })} iconEnd="arrow">
                جرّب التنبؤ
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={4} reached={st.step} title="اطلب تنبؤًا" instruction="اختر يومًا وساعة وظروفًا، ثم اضغط «توقّع».">
        <div className="grid md:grid-cols-[1.2fr_1fr] gap-5">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-bold mb-2">اليوم</div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d, i) => (
                  <Chip key={d} active={st.wd === i} onClick={() => set({ wd: i, predicted: false })}>
                    {d}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="hour" className="text-sm font-bold mb-2 flex justify-between">
                <span>الساعة</span>
                <span className="tabular-nums" style={{ color: meta.color }} dir="ltr">
                  {fmtHour(st.hour)}
                </span>
              </label>
              <input id="hour" type="range" min={12} max={23} value={st.hour} onChange={(e) => set({ hour: Number(e.target.value), predicted: false })} className="w-full accent-[var(--accent)]" dir="ltr" />
            </div>
            {features.some((f) => ['promo', 'event', 'eid', 'payday'].includes(f)) ? (
              <div className="flex flex-wrap gap-2">
                {features.includes('eid') && (
                  <Chip active={st.eid} onClick={() => set({ eid: !st.eid, predicted: false })}>
                    {st.eid ? '✓' : '+'} ليلة العيد
                  </Chip>
                )}
                {features.includes('payday') && (
                  <Chip active={st.payday} onClick={() => set({ payday: !st.payday, predicted: false })}>
                    {st.payday ? '✓' : '+'} يوم 27 (الراتب)
                  </Chip>
                )}
                {features.includes('promo') && (
                  <Chip active={st.promo} onClick={() => set({ promo: !st.promo, predicted: false })}>
                    {st.promo ? '✓' : '+'} فيه عرض ترويجي
                  </Chip>
                )}
                {features.includes('event') && (
                  <Chip active={st.event} onClick={() => set({ event: !st.event, predicted: false })}>
                    {st.event ? '✓' : '+'} فعالية على الكورنيش
                  </Chip>
                )}
              </div>
            ) : null}
            <Button variant="accent" icon="spark" onClick={() => set({ predicted: true })}>
              توقّع
            </Button>
          </div>
          <div className={cx('rounded-2xl border-2 p-5 text-center transition-all', st.predicted ? 'opacity-100' : 'opacity-50')} style={{ borderColor: st.predicted ? level.color : '#DCE0EE' }} aria-live="polite">
            {st.predicted ? (
              <div className="animate-pop" key={`${st.wd}-${st.hour}-${st.promo}-${st.event}`}>
                <div className="text-sm text-ink-500">
                  {WEEKDAYS[st.wd]} · <bdi dir="ltr">{fmtHour(st.hour)}</bdi>
                </div>
                <div className="text-5xl font-bold tabular-nums my-2" style={{ color: level.color }}>
                  {Math.round(pred)}
                </div>
                <div className="text-sm text-ink-500">طلب متوقع في الساعة (±{ev.mae.toFixed(0)})</div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 font-bold text-white" style={{ background: level.color }}>
                  {level.label}
                </div>
                <div className="mt-3 text-sm text-ink-600">
                  فريق مقترح: <b>{staffFor(pred)}</b> موظفين
                </div>
              </div>
            ) : (
              <div className="py-10 text-ink-400">النتيجة تظهر هنا</div>
            )}
          </div>
        </div>
        {st.predicted && (
          <div className="mt-5 animate-rise">
            <div className="text-sm font-bold mb-2">وهكذا بيكون المطعم لو جهّزنا {staffAr(staffFor(pred))} حسب التوقع:</div>
            <LiveRestaurant hour={st.hour} orders={pred} staff={staffFor(pred)} eid={st.eid} caption="جرّب «ليلة العيد» الساعة 9 مساءً 🎆" />
          </div>
        )}
        {st.step === 3 && (
          <div className="flex justify-end mt-4">
            <Button variant="accent" disabled={!st.predicted} why="اضغط «توقّع» أولًا" onClick={() => set({ step: 4 })} iconEnd="arrow">
              حوّلها لخاصية في التطبيق
            </Button>
          </div>
        )}
      </Step>

      <Step n={5} reached={st.step} title="من نموذج إلى خاصية في التطبيق" instruction="النموذج وحده ما يفيد أحد. مهندس تعلم الآلة يربطه بواجهة برمجية API يستدعيها التطبيق. اضغط «انشر».">
        <div className="grid md:grid-cols-2 gap-5 items-start">
          <div className="space-y-3">
            <pre dir="ltr" className="text-left text-xs bg-ink-950 text-ink-100 rounded-xl p-4 overflow-x-auto">
              <span className="text-emerald-400">GET</span> /api/predict?day={WEEKDAYS_EN[st.wd].toLowerCase()}&hour={st.hour}
              {'\n\n'}
              {JSON.stringify({ predicted_orders: Math.round(pred), crowd_level: level.key, suggested_staff: staffFor(pred), model_version: 'v1.0-weeks1-3' }, null, 2)}
            </pre>
            <GovTip>{meta.govNote}</GovTip>
            {!st.published ? (
              <Button variant="accent" icon="play" onClick={() => set({ published: true })} disabled={st.step !== 4}>
                انشر الخاصية
              </Button>
            ) : (
              <Feedback kind="success">انتشرت! تطبيق DataBite يعرض الآن الزحمة المتوقعة للعملاء، ويرسل التوقع للوحة الإدارة.</Feedback>
            )}
          </div>
          <PhoneMock wd={st.wd} on={st.published} model={model} />
        </div>
        {st.published && st.step === 4 && (
          <div className="flex justify-end mt-4">
            <Button variant="accent" onClick={() => set({ step: 5 })} iconEnd="arrow">
              شوف مخرج المحطة
            </Button>
          </div>
        )}
      </Step>

      {st.step >= 5 && (
        <StationOutro
          meta={meta}
          onContinue={finish}
          nextLabel={nextLabelFor('ml')}
          output={
            <div>
              <div className="text-2xl font-bold mb-3">نموذج تنبؤ يعمل + خاصية في التطبيق</div>
              <p className="text-white/75 text-sm mb-3">{CONFIG_INFO[run.config].ar} · {features.length} خصائص · مدرّب على {ev.trainRows} سجل</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/10 px-3 py-2.5">
                  <div className="text-2xl font-bold tabular-nums">±{ev.realMae.toFixed(1)}</div>
                  <div className="text-xs text-white/70">الخطأ على أسبوع جديد</div>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-2.5">
                  <div className="text-2xl font-bold tabular-nums">{Math.round(ev.within5 * 100)}%</div>
                  <div className="text-xs text-white/70">ضمن ±5 طلبات</div>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-2.5">
                  <div className="text-2xl font-bold">API</div>
                  <div className="text-xs text-white/70">منشور في التطبيق</div>
                </div>
              </div>
              <p className="mt-3 text-white/80 text-sm">→ مختص ذكاء الأعمال بيحط التوقعات في لوحة قرارات للإدارة.</p>
            </div>
          }
        />
      )}
    </StationShell>
  );
}

function PhoneMock({ wd, on, model }: { wd: number; on: boolean; model: { predict: (x: ReturnType<typeof realInputs>) => number } }) {
  const preds = HOURS.map((h) => model.predict(realInputs({ weekday: wd, hour: h, promo: false, event: false, day: 60 })));
  const max = Math.max(...preds);
  const best = HOURS[preds.indexOf(Math.min(...preds.slice(0, 9)))];
  return (
    <div className="mx-auto w-[250px] rounded-[2rem] border-[7px] border-ink-900 bg-white shadow-lift overflow-hidden">
      <div className="bg-ink-900 h-5 flex justify-center">
        <div className="w-16 h-3 rounded-b-xl bg-ink-950" />
      </div>
      <div className="p-4">
        <div className="text-xs text-ink-500">مرحبًا 👋</div>
        <div className="font-bold text-lg">DataBite</div>
        <div className={cx('mt-3 rounded-xl p-3 transition-all duration-500', on ? 'bg-[var(--accent-soft)]' : 'bg-ink-50')}>
          <div className="text-xs font-bold mb-2 flex items-center gap-1">
            {on ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> : <Icon name="lock" size={11} />}
            الزحمة المتوقعة — {WEEKDAYS[wd]}
          </div>
          <div className="flex items-end gap-[3px] h-16" dir="ltr">
            {preds.map((p, i) => (
              <div key={i} className="flex-1 rounded-t-sm transition-all duration-700" style={{ height: on ? `${(p / max) * 100}%` : '15%', background: on ? crowdLevel(p).color : '#DCE0EE', transitionDelay: `${i * 40}ms` }} />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-ink-400 mt-1" dir="ltr">
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </div>
        {on ? (
          <div className="mt-3 rounded-xl bg-emerald-50 text-emerald-900 text-xs p-2.5 animate-rise">
            💡 أهدأ وقت للزيارة: <b dir="ltr">{fmtHour(best)}</b>
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-ink-50 text-ink-400 text-xs p-2.5">الخاصية غير مفعّلة بعد</div>
        )}
        <div className="mt-3 h-8 rounded-lg bg-ink-900 text-white text-xs grid place-items-center">اطلب الآن</div>
      </div>
    </div>
  );
}

const PLAIN: Record<Snip, { emoji: string; title: string; student: string }> = {
  a: { emoji: '📝', title: 'يحفظ كل شي، ونختبره بنفس الأسئلة', student: 'مثل طالب حفظ أجوبة الاختبار حرفيًا، وجاه نفس الاختبار. يطلع 100% — بس هل فهم؟' },
  b: { emoji: '📘', title: 'يذاكر أسبوعين، ويُختبر بالباقي', student: 'مثل طالب ذاكر فصلين بس. الاختبار صادق، لكنه ما ذاكر فصل ليلة العيد أبدًا.' },
  c: { emoji: '✅', title: 'يذاكر 3 أسابيع، ويُختبر بالرابع', student: 'مثل طالب ذاكر 3 فصول واختبرناه بفصل جديد. نعرف بصدق هل فهم.' },
};

/** 4 weeks: which ones the model studies, which ones it is tested on. */
function WeekStrip({ k }: { k: Snip }) {
  const role = (w: number): 'train' | 'test' | 'both' => (k === 'a' ? 'both' : k === 'b' ? (w <= 2 ? 'train' : 'test') : w <= 3 ? 'train' : 'test');
  const style = { train: 'bg-sky-100 text-sky-900 border-sky-300', test: 'bg-amber-100 text-amber-900 border-amber-300', both: 'bg-rose-100 text-rose-900 border-rose-300' };
  const label = { train: 'يذاكر', test: 'اختبار', both: 'يحفظ + اختبار' };
  return (
    <div className="mt-3">
      <div className="grid grid-cols-4 gap-1 text-center" dir="rtl">
        {[1, 2, 3, 4].map((w) => (
          <div key={w} className={cx('rounded-md border px-1 py-1.5', style[role(w)])}>
            <div className="text-[11px] font-bold">الأسبوع {w}</div>
            <div className="text-[10px]">{label[role(w)]}</div>
            {w === 3 && <div className="text-[10px]">🎉 العيد</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
