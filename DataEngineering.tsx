import { upsetAr, staffAr } from './sim';
import { useEffect, useState } from 'react';
import { stationById } from './stations';
import { DUPLICATE_COUNT, MISSING_CELLS, MissingStrategy, RAW_DELIVERY, RAW_POS, RAW_ROW_COUNT, SNAPSHOT_ALTERNATIVES, SNAPSHOT_CLEAN, TRUTH, buildDataset, thu21, dateAr, fmtHour, fmtHour24, hourLabelAr, mean, round1 } from './dataset';
import { computeProject, decisionsFrom, missingTier, useProject } from './project';
import { Impact, TierBadge } from './Decision';
import { Consequence } from './Consequence';
import { useStationState, useStore } from './store';
import { Step, StationOutro, StationShell, nextAfter, nextLabelFor, useFastSkip } from './Shell';
import { Button, Feedback, FeedbackKind, GovTip, OptionCard, cx, En } from './ui';
import { Icon } from './Icon';

const meta = stationById('de');
type Issue = 'dup' | 'missing' | 'format';
const ISSUE_LABEL: Record<Issue, string> = { dup: 'صفوف مكررة', missing: 'قيمة مفقودة', format: 'صيغ غير موحّدة' };
type Missing = 'drop' | 'zero' | 'overall' | 'sameSlot';

const DUP_HOURS_POS = new Set([19, 22]);
const SNAP_DATE = dateAr(SNAPSHOT_CLEAN[0].date);
const MISSING_TS = RAW_POS.find((r) => r.missing)!.ts;
const STRATS: MissingStrategy[] = ['sameSlot', 'overall', 'drop', 'zero'];
const STRAT_AR: Record<MissingStrategy, string> = { sameSlot: 'متوسط نفس الساعة', overall: 'المتوسط العام', drop: 'حذف الصفوف', zero: 'صفر' };
/** real error of each strategy on the missing cells (we know the truth because the data is educational) */
const IMPUTE_ERR = Object.fromEntries(
  STRATS.map((st) => {
    const rows = buildDataset(st).rows.filter((r) => r.imputed);
    return [st, rows.length ? round1(mean(rows.map((r) => Math.abs(r.orders - TRUTH.find((t) => t.id === r.id)!.orders)))) : null];
  }),
) as Record<MissingStrategy, number | null>;
const DUP_HOURS_DEL = new Set([20]);

export function DataEngineering() {
  const { state, dispatch, go } = useStore();
  const project = useProject();
  const [st, set] = useStationState('de', {
    step: 0,
    found: [] as Issue[],
    removed: [] as string[],
    missing: null as Missing | null,
    timeFmt: null as '24' | '12' | null,
    merged: false,
  });
  const [fb, setFb] = useState<{ kind: FeedbackKind; text: string } | null>(null);
  const [hint, setHint] = useState(false);
  const [mergeAnim, setMergeAnim] = useState(st.merged ? 99 : -1);
  const [oops, setOops] = useState<Missing | null>(null);
  // the harmful choice, played forward through the whole project
  const zeroProject = computeProject({ ...decisionsFrom(state), de: { missing: 'zero', timeFmt: '24' } });
  const peakIdx = zeroProject.eidTruth.indexOf(Math.max(...zeroProject.eidTruth));
  const skipped = useFastSkip(st, set, { 0: { found: ['dup', 'missing', 'format'] }, 3: { timeFmt: '24' } });

  useEffect(() => {
    setFb(null);
    setHint(false);
  }, [st.step]);

  // ---------- step 1: inspect -------------
  const inspect = (issue: Issue | null, text: string) => {
    if (issue) {
      if (!st.found.includes(issue)) set({ found: [...st.found, issue] });
      setFb({ kind: 'success', text });
    } else setFb({ kind: 'hint', text });
  };

  // ---------- step 2: remove duplicates --------
  const pos = RAW_POS.filter((r) => !st.removed.includes(r.key));
  const del = RAW_DELIVERY.filter((r) => !st.removed.includes(r.key));
  const dupsLeft = 3 - st.removed.length;
  const removeRow = (source: 'pos' | 'del', hour: number) => {
    const dupKey = RAW_POS.find((r) => source === 'pos' && r.hour === hour && r.dup)?.key ?? RAW_DELIVERY.find((r) => source === 'del' && r.hour === hour && r.dup)?.key;
    if (dupKey && !st.removed.includes(dupKey)) {
      const removed = [...st.removed, dupKey];
      set({ removed });
      setFb({ kind: 'success', text: `حُذف التكرار لساعة ${fmtHour(hour)}. ${removed.length === 3 ? 'ممتاز! ما بقي أي تكرار.' : `باقي ${3 - removed.length === 1 ? 'واحد' : 3 - removed.length}.`}` });
    } else {
      setFb({ kind: 'hint', text: `صف ${fmtHour(hour)} موجود مرة واحدة فقط — هذا صف أصلي، نحتاجه. ابحث عن ساعة تظهر مرتين في نفس الجدول.` });
    }
  };

  // ---------- step 3: missing --------------
  const missingFeedback: Record<Missing, { kind: FeedbackKind; text: string }> = {
    drop: { kind: 'hint', text: '' },
    zero: { kind: 'hint', text: '' },
    overall: { kind: 'hint', text: '' },
    sameSlot: { kind: 'success', text: '' },
  };
  const impactText = (k: Missing) => {
    const res = buildDataset(k);
    const thu = thu21(res.rows);
    const thuBest = thu21(buildDataset('sameSlot').rows);
    if (k === 'sameSlot')
      return `طبّقنا القرار على ${res.affected} ساعة مفقودة في الأسابيع الأربعة. كل قيمة = متوسط نفس اليوم ونفس الساعة في الأيام العادية (بدون ليلة العيد)، ومعلَّمة "مُقدّرة". متوسط خطأ التقدير مقارنة بالحقيقة: ±${IMPUTE_ERR.sameSlot} طلب.`;
    if (k === 'overall')
      return `عوّضنا ${res.affected} ساعة بمتوسط عام = ${SNAPSHOT_ALTERNATIVES.overall} طلب صالة. المشكلة: كل الساعات المفقودة ذروة مسائية، فقلّلناها. متوسط إجمالي طلبات الخميس 9 مساءً صار ${thu} بدل ${thuBest}. خطأ التقدير ±${IMPUTE_ERR.overall}.`;
    if (k === 'drop')
      return `حذفنا ${res.removed} سجل — صار عندنا ${res.rows.length} بدل 336. ما أضفنا أرقامًا مخترعة، لكن خسرنا ساعات ذروة: المحلل والنموذج بيشوفون ليالي خميس وجمعة أقل.`;
    return `${res.affected} ساعة ذروة صارت بصفر طلبات صالة. متوسط إجمالي طلبات الخميس 9 مساءً نزل إلى ${thu} بدل ${thuBest}، وخطأ التقدير ±${IMPUTE_ERR.zero} طلب. وهذا الخطأ بيمشي للتحليل والنموذج.`;
  };

  // ---------- step 5: merge animation ----------
  useEffect(() => {
    if (mergeAnim < 0 || mergeAnim >= SNAPSHOT_CLEAN.length) return;
    const t = setTimeout(() => setMergeAnim((m) => m + 1), 260);
    return () => clearTimeout(t);
  }, [mergeAnim]);

  const finish = () => {
    dispatch({ type: 'complete', id: 'de', output: { missingStrategy: 'sameSlot', removed: 3 } });
    go(nextAfter('de'));
  };

  const displayTime = (h: number) => (st.timeFmt === '12' ? fmtHour12Ar(h) : fmtHour24(h));

  return (
    <StationShell meta={meta}>
      <div className="rounded-2xl bg-white border border-ink-200 p-4 flex gap-3 items-start text-[15px]">
        <span className="shrink-0 mt-0.5" style={{ color: meta.color }}>
          <Icon name="store" />
        </span>
        <p className="text-ink-700">
          بيانات المطعم تجي من مصدرين: <b>نظام نقاط البيع</b> <En>POS</En> لطلبات الصالة، و<b>تطبيق التوصيل</b> <En>Delivery App</En>. هذه لقطة من ليلة الخميس {SNAP_DATE} في فرع الكورنيش — وفيها مشاكل لازم نحلها قبل ما يستخدمها أحد.
        </p>
      </div>

      {/* STEP 1 */}
      <Step n={1} skipped={skipped(1)} reached={st.step} title="افحص المصدرين" instruction="اضغط على أي خلية أو صف تشك أن فيه مشكلة. ابحث عن 3 أنواع من المشاكل.">
        <div className="flex flex-wrap gap-2 mb-4">
          {(['dup', 'missing', 'format'] as Issue[]).map((i) => (
            <span key={i} className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm border', st.found.includes(i) ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-ink-50 border-ink-200 text-ink-500')}>
              {st.found.includes(i) ? <Icon name="check" size={14} stroke={3} /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-current" />}
              {ISSUE_LABEL[i]}
            </span>
          ))}
        </div>
        <SourceTables
          pos={RAW_POS}
          del={RAW_DELIVERY}
          interactive={st.step === 0}
          hint={hint ? (['dup', 'missing', 'format'] as Issue[]).filter((i) => !st.found.includes(i)) : []}
          onPosRow={(r) =>
            DUP_HOURS_POS.has(r.hour)
              ? inspect('dup', `صف الساعة ${fmtHour(r.hour)} مكرر في نظام نقاط البيع — نفس الوقت ونفس الرقم مرتين. لو تركناه بنحسب الطلبات مرتين.`)
              : inspect(null, 'هذا الصف يبدو سليمًا. دقق: هل فيه ساعة تتكرر؟ أو خانة فاضية؟')
          }
          onPosMissing={() => inspect('missing', 'خانة طلبات الصالة الساعة 9 مساءً (21:00) فاضية! غالبًا انقطع الاتصال بالنظام لحظة التصدير.')}
          onDelRow={(r) =>
            DUP_HOURS_DEL.has(r.hour)
              ? inspect('dup', `صف ${r.time} مكرر في تطبيق التوصيل.`)
              : inspect(null, 'أرقام هذا الصف سليمة. انظر لطريقة كتابة الوقت واليوم مقارنة بالمصدر الثاني.')
          }
          onDelFormat={() => inspect('format', 'المصدران يكتبان الوقت بطريقتين: "2025-06-12 21:00" مقابل "9:00 PM"، واليوم "Thu" بالإنجليزي. لازم نوحّد الصيغة قبل الدمج.')}
        />
        <div className="mt-4 space-y-3">
          {fb && st.step === 0 && <Feedback kind={fb.kind}>{fb.text}</Feedback>}
          {st.found.length === 3 && (
            <Feedback kind="info" title="وفي البيانات كاملة (4 أسابيع):">
              {DUPLICATE_COUNT} صفوف مكررة · {MISSING_CELLS.length} خانة مفقودة · {336} وقت بصيغة 12 ساعة في تطبيق التوصيل. المجموع الخام {RAW_ROW_COUNT} صف.
            </Feedback>
          )}
          {st.step === 0 && (
            <div className="flex gap-2 justify-between flex-wrap">
              <Button variant="ghost" size="sm" icon="bulb" onClick={() => setHint(true)}>
                ساعدني ألقاها
              </Button>
              <Button variant="accent" disabled={st.found.length < 3} why={`لقيت ${st.found.length} من 3 — اضغط على المشاكل في الجدولين`} onClick={() => set({ step: 1 })} iconEnd="arrow">
                {st.found.length < 3 ? `وجدت ${st.found.length} من 3` : 'لقيت المشاكل الثلاث — يلا ننظّف'}
              </Button>
            </div>
          )}
        </div>
      </Step>

      {/* STEP 2 */}
      <Step n={2} reached={st.step} title="احذف الصفوف المكررة" instruction="اضغط على الصف المكرر لحذفه. المكرر = نفس الساعة ونفس الرقم مرتين في نفس المصدر.">
        <div className="text-sm font-semibold mb-3 tabular-nums" style={{ color: meta.color }}>
          {dupsLeft > 0 ? `باقي ${dupsLeft} من 3 صفوف مكررة` : 'تم حذف كل التكرار ✓'}
        </div>
        <SourceTables
          pos={pos}
          del={del}
          interactive={st.step === 1}
          hint={hint ? ['dup'] : []}
          onPosRow={(r) => removeRow('pos', r.hour)}
          onDelRow={(r) => removeRow('del', r.hour)}
          onPosMissing={() => setFb({ kind: 'hint', text: 'هذي القيمة المفقودة — بنتعامل معها في الخطوة الجاية. الحين ركّز على التكرار.' })}
          onDelFormat={() => setFb({ kind: 'hint', text: 'الصيغ بنوحدها بعد شوي. الحين دوّر على الصفوف المكررة.' })}
          rowMode
        />
        <div className="mt-4 space-y-3">
          {fb && st.step === 1 && <Feedback kind={fb.kind}>{fb.text}</Feedback>}
          {st.step === 1 && (
            <div className="flex gap-2 justify-between flex-wrap">
              <Button variant="ghost" size="sm" icon="bulb" onClick={() => setHint(true)}>
                تلميح
              </Button>
              <Button variant="accent" disabled={dupsLeft > 0} why={dupsLeft === 1 ? 'باقي صف مكرر واحد' : `باقي ${dupsLeft} صفوف مكررة`} onClick={() => set({ step: 2 })} iconEnd="arrow">
                التالي: القيمة المفقودة
              </Button>
            </div>
          )}
        </div>
      </Step>

      {/* STEP 3 */}
      <Step n={3} reached={st.step} title="عالج القيم المفقودة" instruction={`في هذه اللقطة خانة الساعة 9 مساءً فاضية — وفي الأسابيع الأربعة كاملة ${MISSING_CELLS.length} خانة مثلها (انقطاع الكاشير وقت الزحمة). قرارك هنا يُطبَّق عليها كلها ويمشي لباقي المشروع.`}>
        <div className="flex items-center gap-3 rounded-xl bg-ink-50 border border-ink-200 px-4 py-3 mb-4 w-fit" dir="ltr">
          <span className="font-mono text-sm text-ink-600">{MISSING_TS}</span>
          <span className="text-ink-300">│</span>
          <span
            className={cx('font-mono font-bold px-2.5 py-0.5 rounded-md transition-all', st.missing === 'sameSlot' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700')}
          >
            {st.missing === 'sameSlot' ? SNAPSHOT_ALTERNATIVES.sameSlot : st.missing === 'zero' ? '0' : st.missing === 'overall' ? SNAPSHOT_ALTERNATIVES.overall : st.missing === 'drop' ? '— deleted —' : 'NULL'}
          </span>
          {st.missing === 'sameSlot' && <span className="text-xs text-emerald-700 font-semibold" dir="rtl">مُقدّرة</span>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {(
            [
              ['drop', 'احذف الصفوف الناقصة', `أسهل حل: نتخلص من ${MISSING_CELLS.length} صف فيها نقص.`],
              ['zero', 'عوّضها بصفر', 'نعتبر أنه ما فيه طلبات في الصالة.'],
              ['overall', 'عوّضها بمتوسط كل الساعات', `متوسط طلبات الصالة لكل الساعات = ${SNAPSHOT_ALTERNATIVES.overall}`],
              ['sameSlot', 'عوّضها بمتوسط نفس اليوم والساعة في الأيام العادية', `مثلًا الخميس 9 مساءً (بدون ليلة العيد) = ${SNAPSHOT_ALTERNATIVES.sameSlot} طلب صالة`],
            ] as [Missing, string, string][]
          ).map(([k, t, d]) => (
            <OptionCard
              key={k}
              selected={st.missing === k}
              state={st.missing === k ? (k === 'sameSlot' ? 'right' : 'wrong') : null}
              disabled={st.step !== 2}
              onClick={() => {
                set({ missing: k });
                setFb(missingFeedback[k]);
                if (missingTier(k) === 'harm') setOops(k);
              }}
            >
              <div className="font-bold">{t}</div>
              <div className="text-sm text-ink-500 mt-0.5">{d}</div>
            </OptionCard>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {st.missing && st.step >= 2 && (
            <Impact tier={missingTier(st.missing)} title={`أثر قرارك على ${buildDataset(st.missing).affected} سجل`}>
              {impactText(st.missing)}
            </Impact>
          )}
          {st.missing && <StrategyCompare chosen={st.missing} />}
          {st.step === 2 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={!st.missing} why="اختر طريقة لمعالجة القيم المفقودة" onClick={() => set({ step: 3 })} iconEnd="arrow">
                التالي: توحيد الصيغ
              </Button>
            </div>
          )}
          <GovTip>وثّقنا أن هذه القيمة "مُقدّرة" وليست مسجّلة — الشفافية حول التعديلات جزء من جودة البيانات.</GovTip>
        </div>
        <Consequence
          open={!!oops}
          headline="بعد أسابيع… ليلة العيد"
          story={`البيانات اللي فيها أصفار علّمت النموذج أن ليالي الذروة أهدأ من الحقيقة. توقّع ${Math.round(zeroProject.eidForecast[peakIdx])} طلب الساعة ${fmtHour(zeroProject.eidTruth.indexOf(Math.max(...zeroProject.eidTruth)) + 12)} فجهّزت أم فهد ${staffAr(zeroProject.recommendedStaff)} — والطلب الحقيقي ${Math.round(zeroProject.eidTruth[peakIdx])}.`}
          hour={12 + peakIdx}
          orders={zeroProject.eidTruth[peakIdx]}
          staff={zeroProject.recommendedStaff}
          eid
          lesson={`قرار صغير في تنظيف البيانات يمشي في كل المراحل اللي بعده: التحليل، النموذج، ثم قرار التوظيف. محسوبًا على كامل ليلة العيد: ${upsetAr(zeroProject.outcome.upset)}.`}
          onRewind={() => {
            setOops(null);
            set({ missing: null });
            setFb(null);
          }}
          onProceed={() => setOops(null)}
        />
      </Step>

      {/* STEP 4 */}
      <Step n={4} skipped={skipped(4)} reached={st.step} title="وحّد صيغة الوقت" instruction="المصدران يكتبان الوقت بشكل مختلف. اختر صيغة واحدة نعتمدها للمصدرين.">
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          {(
            [
              ['24', '21:00', 'نظام 24 ساعة — شائع في قواعد البيانات، ما فيه لبس بين الصباح والمساء.'],
              ['12', '9:00 PM', 'نظام 12 ساعة مع AM/PM — مألوف للناس، لكن أطول وأسهل يصير فيه خطأ.'],
            ] as ['24' | '12', string, string][]
          ).map(([k, ex, d]) => (
            <OptionCard key={k} selected={st.timeFmt === k} disabled={st.step !== 3} onClick={() => set({ timeFmt: k })}>
              <div className="font-mono font-bold text-lg" dir="ltr">
                {ex}
              </div>
              <div className="text-sm text-ink-500 mt-0.5">{d}</div>
            </OptionCard>
          ))}
        </div>
        {st.timeFmt && (
          <div className="grid sm:grid-cols-2 gap-3 animate-rise">
            {[
              { title: 'نقاط البيع — قبل/بعد', rows: SNAPSHOT_CLEAN.map((r) => [`${r.date} ${fmtHour24(r.hour)}`, `الخميس · ${displayTime(r.hour)}`]) },
              { title: 'التوصيل — قبل/بعد', rows: SNAPSHOT_CLEAN.map((r) => [`Thu ${RAW_DELIVERY.find((d) => d.hour === r.hour)!.time}`, `الخميس · ${displayTime(r.hour)}`]) },
            ].map((t) => (
              <div key={t.title} className="rounded-xl border border-ink-200 overflow-hidden">
                <div className="bg-ink-50 px-3 py-2 text-sm font-bold">{t.title}</div>
                <ul className="divide-y divide-ink-100 text-sm">
                  {t.rows.map(([a, b], i) => (
                    <li key={i} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <bdi dir="ltr" className="font-mono text-ink-400 line-through decoration-ink-300">
                        {a}
                      </bdi>
                      <Icon name="arrow" size={14} className="text-ink-300 shrink-0" />
                      <span className="font-semibold animate-pop tabular-nums" style={{ animationDelay: `${i * 60}ms` }}>
                        {b}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 space-y-3">
          {st.timeFmt && st.step >= 3 && (
            <Feedback kind="success">
              {st.timeFmt === '24'
                ? 'صار الوقت موحّدًا بصيغة 24 ساعة، واليوم بالعربي. الأهم من الصيغة نفسها: أن تكون واحدة في كل المصادر.'
                : 'تم التوحيد بصيغة 12 ساعة. اختيار مقبول — المهم أن الصيغة صارت واحدة. (في الأنظمة غالبًا نخزّن 24 ساعة ونعرض 12 للناس.)'}
            </Feedback>
          )}
          {st.step === 3 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={!st.timeFmt} why="اختر صيغة الوقت" onClick={() => set({ step: 4 })} iconEnd="arrow">
                التالي: الدمج
              </Button>
            </div>
          )}
        </div>
      </Step>

      {/* STEP 5 */}
      <Step n={5} reached={st.step} title="ادمج المصدرين في جدول واحد" instruction="الحين البيانات نظيفة. اضغط «ادمج» عشان نربط المصدرين حسب الساعة ونحسب إجمالي الطلبات.">
        <Pipeline active={mergeAnim >= 0} />
        {mergeAnim < 0 ? (
          <div className="flex justify-center my-4">
            <Button
              variant="accent"
              size="lg"
              icon="play"
              onClick={() => {
                setMergeAnim(0);
                set({ merged: true });
              }}
            >
              ادمج حسب الساعة
            </Button>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[460px]">
              <thead>
                <tr className="text-ink-500 border-b border-ink-200">
                  <th className="text-right font-medium py-2 px-2">الوقت</th>
                  <th className="text-right font-medium py-2 px-2">
                    الصالة <span className="text-[10px]">(POS)</span>
                  </th>
                  <th className="text-right font-medium py-2 px-2">التوصيل</th>
                  <th className="text-right font-bold py-2 px-2 text-ink-900">إجمالي الطلبات</th>
                </tr>
              </thead>
              <tbody>
                {SNAPSHOT_CLEAN.map((r, i) =>
                  i < mergeAnim ? (
                    <tr key={r.hour} className="border-b border-ink-100 animate-rise">
                      <td className="py-2 px-2 tabular-nums">الخميس · {displayTime(r.hour)}</td>
                      <td className="py-2 px-2 tabular-nums">
                        {r.dinein}
                        {r.imputed && <span className="text-[10px] text-emerald-700 font-semibold ms-1">مُقدّرة</span>}
                      </td>
                      <td className="py-2 px-2 tabular-nums">{r.delivery}</td>
                      <td className="py-2 px-2 tabular-nums font-bold" style={{ color: meta.color }}>
                        {r.orders}
                      </td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
        )}
        {mergeAnim >= SNAPSHOT_CLEAN.length && (
          <div className="mt-4 space-y-3">
            <Feedback kind="success" title="الجدول صار نظيفًا وموحّدًا">
              طبّقنا نفس الخطوات (حذف التكرار، معالجة المفقود، توحيد الصيغ، الدمج) على بيانات الأسابيع الأربعة كاملة بشكل آلي — هذا بالضبط اللي يسويه "أنبوب البيانات" <En>Data Pipeline</En>.
            </Feedback>
            <GovTip>{meta.govNote}</GovTip>
            {st.step === 4 && (
              <div className="flex justify-end">
                <Button variant="accent" onClick={() => set({ step: 5 })} iconEnd="arrow">
                  شوف مخرج المحطة
                </Button>
              </div>
            )}
          </div>
        )}
      </Step>

      {st.step >= 5 && (
        <StationOutro
          meta={meta}
          onContinue={finish}
          nextLabel={nextLabelFor('de')}
          output={
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="text-2xl font-bold">مجموعة بيانات DataBite النظيفة</div>
                <TierBadge tier={missingTier(project.d.de.missing)} />
              </div>
              <BeforeAfter />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  [project.clean.rows.length, 'سجل ساعي'],
                  [`${DUPLICATE_COUNT} ← 0`, 'مكررات'],
                  [project.clean.removed ? `${project.clean.removed} محذوف` : `${project.clean.affected}`, project.clean.removed ? 'سجل ناقص' : 'قيمة معوّضة وموثّقة'],
                  [project.d.de.missing === 'sameSlot' ? '★' : project.d.de.missing === 'zero' ? '⚠' : '◐', STRAT_AR[project.d.de.missing]],
                ].map(([v, l]) => (
                  <div key={l as string} className="rounded-xl bg-white/10 px-3 py-2.5">
                    <div className="text-2xl font-bold tabular-nums">{v}</div>
                    <div className="text-xs text-white/70">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm text-white/75 flex flex-wrap gap-1.5" dir="ltr">
                {['date', 'weekday', 'hour', 'dinein', 'delivery', 'orders', 'promo', 'event', 'temperature', 'staff'].map((c) => (
                  <span key={c} className="font-mono rounded bg-white/10 px-1.5 py-0.5">
                    {c}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-white/80 text-sm">→ ينتقل الآن إلى محلل البيانات ليكتشف الأنماط ({hourLabelAr(21)} وغيرها).</p>
            </div>
          }
        />
      )}
    </StationShell>
  );
}

function fmtHour12Ar(h: number) {
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:00 م`;
}

function Pipeline({ active }: { active: boolean }) {
  const stages = ['بيانات خام', 'حذف التكرار', 'معالجة المفقود', 'توحيد الصيغ', 'دمج', 'بيانات نظيفة'];
  return (
    <div className="relative rounded-xl bg-ink-950 p-4 overflow-hidden" aria-label="مسار تحويل البيانات من خام إلى نظيفة">
      <div className="flex items-center justify-between gap-1 relative z-10">
        {stages.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
            <div
              className={cx('rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-center whitespace-nowrap transition-all duration-500', active ? 'text-white' : 'text-white/50')}
              style={{
                background: active ? (i === 0 ? '#E11D48' : i === stages.length - 1 ? '#10B981' : '#0891B2') : '#ffffff12',
                transitionDelay: `${i * 180}ms`,
              }}
            >
              {s}
            </div>
            {i < stages.length - 1 && (
              <div className="flex-1 h-0.5 bg-white/10 relative overflow-hidden min-w-[8px]">
                {active && <div className="absolute inset-0 animate-flow" style={{ backgroundImage: 'linear-gradient(90deg, transparent 0 50%, #22D3EE 50% 100%)', backgroundSize: '20px 2px', width: '200%' }} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type PosRow = (typeof RAW_POS)[number];
type DelRow = (typeof RAW_DELIVERY)[number];

function SourceTables({
  pos,
  del,
  interactive,
  hint,
  onPosRow,
  onPosMissing,
  onDelRow,
  onDelFormat,
  rowMode,
}: {
  pos: PosRow[];
  del: DelRow[];
  interactive: boolean;
  hint: Issue[];
  onPosRow: (r: PosRow) => void;
  onPosMissing: () => void;
  onDelRow: (r: DelRow) => void;
  onDelFormat: () => void;
  rowMode?: boolean;
}) {
  const hl = (cond: boolean) => (cond ? 'ring-2 ring-amber-400 ring-inset bg-amber-50' : '');
  const cellBtn = 'w-full px-3 py-2 transition-colors focus-visible:outline-none focus-visible:bg-cyan-50 hover:bg-cyan-50 disabled:hover:bg-transparent disabled:cursor-default';
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-ink-200 overflow-hidden">
        <div className="flex items-center gap-2 bg-ink-50 px-3 py-2 border-b border-ink-200">
          <Icon name="table" size={16} />
          <span className="font-bold text-sm">نقاط البيع</span>
          <En>pos_export.csv</En>
        </div>
        <div className="grid grid-cols-[1.6fr_1fr] text-xs text-ink-500 border-b border-ink-100 font-mono" dir="ltr">
          <div className="px-3 py-1.5">timestamp</div>
          <div className="px-3 py-1.5">dinein_orders</div>
        </div>
        <ul>
          {pos.map((r) => (
            <li key={r.key} className={cx('grid grid-cols-[1.6fr_1fr] border-b border-ink-100 last:border-0 text-sm font-mono animate-rise', hl(hint.includes('dup') && DUP_HOURS_POS.has(r.hour)))} dir="ltr">
              <button disabled={!interactive} className={cellBtn + ' text-left'} onClick={() => onPosRow(r)} aria-label={`صف ${r.ts}`}>
                {r.ts}
              </button>
              {r.missing ? (
                <button disabled={!interactive} className={cx(cellBtn, 'text-left', hl(hint.includes('missing')))} onClick={onPosMissing} aria-label="خانة فارغة">
                  <span className="text-rose-500 italic">empty</span>
                </button>
              ) : (
                <button disabled={!interactive} className={cellBtn + ' text-left'} onClick={() => onPosRow(r)} aria-label={`${r.dinein} طلب`}>
                  {r.dinein}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-ink-200 overflow-hidden">
        <div className="flex items-center gap-2 bg-ink-50 px-3 py-2 border-b border-ink-200">
          <Icon name="phone" size={16} />
          <span className="font-bold text-sm">تطبيق التوصيل</span>
          <En>delivery_api.json</En>
        </div>
        <div className="grid grid-cols-[1fr_.7fr_1fr] text-xs text-ink-500 border-b border-ink-100 font-mono" dir="ltr">
          <div className="px-3 py-1.5">time</div>
          <div className="px-3 py-1.5">day</div>
          <div className="px-3 py-1.5">orders</div>
        </div>
        <ul>
          {del.map((r) => (
            <li key={r.key} className={cx('grid grid-cols-[1fr_.7fr_1fr] border-b border-ink-100 last:border-0 text-sm font-mono animate-rise', hl(hint.includes('dup') && DUP_HOURS_DEL.has(r.hour)))} dir="ltr">
              <button disabled={!interactive} className={cx(cellBtn, 'text-left', !rowMode && hl(hint.includes('format')))} onClick={() => (rowMode ? onDelRow(r) : onDelFormat())}>
                {r.time}
              </button>
              <button disabled={!interactive} className={cx(cellBtn, 'text-left', !rowMode && hl(hint.includes('format')))} onClick={() => (rowMode ? onDelRow(r) : onDelFormat())}>
                {r.day}
              </button>
              <button disabled={!interactive} className={cellBtn + ' text-left'} onClick={() => onDelRow(r)}>
                {r.delivery}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StrategyCompare({ chosen }: { chosen: MissingStrategy }) {
  return (
    <details className="rounded-xl border border-ink-200 bg-white p-4">
      <summary className="cursor-pointer font-semibold text-sm">قارن الخيارات الأربعة بالأرقام (محسوبة على البيانات كاملة)</summary>
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm min-w-[460px]">
          <thead>
            <tr className="text-ink-500 border-b border-ink-200">
              <th className="text-right font-medium py-2">الخيار</th>
              <th className="text-right font-medium py-2">عدد السجلات</th>
              <th className="text-right font-medium py-2">متوسط إجمالي طلبات الخميس 9 م</th>
              <th className="text-right font-medium py-2">خطأ التقدير</th>
              <th className="text-right font-medium py-2">التقييم</th>
            </tr>
          </thead>
          <tbody>
            {STRATS.map((k) => {
              const res = buildDataset(k);
              return (
                <tr key={k} className={cx('border-b border-ink-100', k === chosen && 'bg-[var(--accent-soft)] font-semibold')}>
                  <td className="py-2">{STRAT_AR[k]}</td>
                  <td className="py-2 tabular-nums">{res.rows.length}</td>
                  <td className="py-2 tabular-nums">{thu21(res.rows)}</td>
                  <td className="py-2 tabular-nums">{IMPUTE_ERR[k] == null ? '—' : `±${IMPUTE_ERR[k]}`}</td>
                  <td className="py-2">
                    <TierBadge tier={missingTier(k)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-500 mt-2">«خطأ التقدير» نقدر نحسبه لأن البيانات تعليمية ونعرف القيم الحقيقية. في الواقع ما تعرفها — لذلك نختار الطريقة المنطقية ونوثّقها.</p>
    </details>
  );
}

function BeforeAfter() {
  const p = useProject();
  const rows = [
    ['عدد الصفوف', RAW_ROW_COUNT, p.clean.rows.length],
    ['صفوف مكررة', DUPLICATE_COUNT, 0],
    ['خانات مفقودة', MISSING_CELLS.length, 0],
    ['صيغ الوقت', '2', '1'],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-center">
      {rows.map(([l, a, b]) => (
        <div key={l as string} className="rounded-xl bg-white/10 px-2 py-2">
          <div className="text-[11px] text-white/60">{l}</div>
          <div className="font-bold tabular-nums" dir="ltr">
            <span className="text-white/50 line-through me-1.5">{a}</span>→ {b}
          </div>
        </div>
      ))}
    </div>
  );
}
