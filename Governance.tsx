import { useEffect, useState } from 'react';
import { OWNER, STATIONS, stationById } from './stations';
import { Avatar } from './Avatar';
import { useStationState, useStore, StationId } from './store';
import { Issue, fixAwaitingDecision, useProject } from './project';
import { Step, StationOutro, StationShell, nextAfter, nextLabelFor, useFastSkip } from './Shell';
import { Button, Feedback, FeedbackKind, OptionCard, cx, En } from './ui';
import { Icon } from './Icon';

const meta = stationById('gov');

const COLS: { id: string; label: string; en: string; kind: 'pii' | 'ops' | 'quasi' }[] = [
  { id: 'order_id', label: 'رقم الطلب', en: 'order_id', kind: 'ops' },
  { id: 'name', label: 'اسم العميل', en: 'customer_name', kind: 'pii' },
  { id: 'phone', label: 'رقم الجوال', en: 'phone', kind: 'pii' },
  { id: 'address', label: 'العنوان', en: 'address', kind: 'pii' },
  { id: 'district', label: 'الحي', en: 'district', kind: 'quasi' },
  { id: 'time', label: 'وقت الطلب', en: 'order_time', kind: 'ops' },
  { id: 'items', label: 'عدد الأصناف', en: 'items', kind: 'ops' },
  { id: 'amount', label: 'المبلغ', en: 'amount_sar', kind: 'ops' },
];
// fictional customers
const ROWS = [
  { order_id: 'D-88231', name: 'سارة الغامدي', phone: '0551234871', address: 'شارع التحلية، مبنى 12', district: 'الروضة', time: '21:04', items: 3, amount: 96 },
  { order_id: 'D-88232', name: 'خالد الزهراني', phone: '0569981204', address: 'طريق الكورنيش، 4ب', district: 'الشاطئ', time: '21:06', items: 2, amount: 58 },
  { order_id: 'D-88233', name: 'نورة باعشن', phone: '0503317765', address: 'أبحر الشمالية، فيلا 7', district: 'أبحر', time: '21:09', items: 5, amount: 142 },
];
const mask = (id: string, v: string | number) => {
  const s = String(v);
  if (id === 'name') return s.split(' ')[0] + ' ' + '***';
  if (id === 'phone') return '05•• ••• ' + s.slice(-3);
  if (id === 'address') return '•••••••';
  return s;
};

type Role = 'analyst' | 'ml' | 'manager' | 'cs';
type Asset = 'agg' | 'pii' | 'pred' | 'dash';
const ROLES: { id: Role; label: string }[] = [
  { id: 'analyst', label: 'محلل البيانات' },
  { id: 'ml', label: 'مهندس تعلم الآلة' },
  { id: 'manager', label: 'مديرة المطعم' },
  { id: 'cs', label: 'موظف خدمة العملاء' },
];
const ASSETS: { id: Asset; label: string }[] = [
  { id: 'agg', label: 'الطلبات المجمّعة (بدون هوية)' },
  { id: 'pii', label: 'بيانات العملاء الشخصية' },
  { id: 'pred', label: 'توقعات النموذج' },
  { id: 'dash', label: 'لوحة المعلومات' },
];
// required true / required false; anything absent is flexible
const RULES: Partial<Record<`${Role}.${Asset}`, { need: boolean; why: string }>> = {
  'analyst.agg': { need: true, why: 'المحلل يحتاج الطلبات المجمّعة — هذا أساس شغله.' },
  'analyst.pii': { need: false, why: 'المحلل يكفيه "كم طلب" لا "مين طلب". أغلق عنه البيانات الشخصية.' },
  'ml.agg': { need: true, why: 'مهندس تعلم الآلة يدرّب النموذج على الطلبات المجمّعة — لازم يوصلها.' },
  'ml.pii': { need: false, why: 'النموذج ما يحتاج أسماء وجوالات العملاء. أقل صلاحية لازمة!' },
  'ml.pred': { need: true, why: 'مهندس تعلم الآلة يراقب توقعات النموذج — يحتاج يشوفها.' },
  'manager.dash': { need: true, why: 'المديرة تتخذ قراراتها من اللوحة — لازم تشوفها.' },
  'manager.pii': { need: false, why: 'المديرة ما تحتاج قاعدة بيانات العملاء كاملة لقرار الورديات.' },
  'cs.pii': { need: true, why: 'خدمة العملاء تحتاج تتواصل مع العميل بخصوص طلبه — هنا البيانات الشخصية مبررة.' },
};

type QFix = 'keep' | 'delete' | 'flag' | 'invent';
type Ethic = 'sell' | 'partial' | 'consent';
const CORRECT_MATRIX = Object.fromEntries(
  ROLES.map((r) => [r.id, Object.fromEntries(ASSETS.map((a) => [a.id, RULES[`${r.id}.${a.id}`]?.need ?? true]))]),
) as Record<Role, Record<Asset, boolean>>;

const FIX_PATCH: Record<string, Record<string, unknown>> = {
  'de-zero': { missing: null }, 'de-overall': { missing: null }, 'de-drop': { missing: null },
  'da-cause': { concl: null },
  'ds-leak': { featuresDone: false, featureOk: false }, 'ds-noeid': { featuresDone: false, featureOk: false }, 'ds-missing': { featuresDone: false, featureOk: false },
  'ds-id': { featuresDone: false, featureOk: false }, 'ds-temp': { featuresDone: false, featureOk: false },
  'ds-flat': { approach: null }, 'ds-hourly': { approach: null },
  'ml-same': { snip: null, trained: false }, 'ml-small': { snip: null, trained: false },
  'bi-phones': {}, 'bi-noise': {},
  'bi-under': {}, 'bi-over': {}, 'bi-tight': {},
};

const ETHICS: { k: Ethic; t: string; fb: string }[] = [
  { k: 'sell', t: 'نبيعها — البيانات بياناتنا والفلوس تفيد المطعم', fb: 'العميل أعطانا رقمه عشان يوصله طلبه، مو عشان تجيه إعلانات. مشاركته للتسويق بدون موافقته الصريحة مخالفة لنظام حماية البيانات الشخصية — وفوقها تخسر ثقة عملائك.' },
  { k: 'partial', t: 'نبيعها بعد ما نخفي آخر 3 أرقام', fb: 'الرقم الناقص ما يفيد شركة الإعلانات أصلًا — وإذا كانت تقدر تكمله، فهو لسا بيانات شخصية. المشكلة الأساسية باقية: ما أخذنا موافقة أحد.' },
  { k: 'consent', t: 'نرفض. وإذا حبّينا نسوي تسويق، نطلب من العملاء موافقة صريحة على هذا الغرض بالذات', fb: '' },
];

export function Governance() {
  const { state, dispatch, go } = useStore();
  const [st, set] = useStationState('gov', {
    step: 0,
    sensitive: [] as string[],
    matrix: Object.fromEntries(ROLES.map((r) => [r.id, Object.fromEntries(ASSETS.map((a) => [a.id, true]))])) as Record<Role, Record<Asset, boolean>>,
    qfix: null as QFix | null,
    ethic: null as Ethic | null,
    reviewed: [] as string[],
    acks: [] as string[],
    disclaimer: false,
  });
  const project = useProject();
  const skipped = useFastSkip(st, set, { 1: { matrix: CORRECT_MATRIX }, 2: { qfix: 'flag' } });
  const [fb, setFb] = useState<{ kind: FeedbackKind; text: string } | null>(null);
  useEffect(() => setFb(null), [st.step]);

  const toggleCol = (id: string) => set({ sensitive: st.sensitive.includes(id) ? st.sensitive.filter((x) => x !== id) : [...st.sensitive, id] });
  const checkCols = () => {
    const wrong = st.sensitive.find((c) => COLS.find((x) => x.id === c)!.kind === 'ops');
    if (wrong) return setFb({ kind: 'hint', text: `"${COLS.find((x) => x.id === wrong)!.label}" بيانات تشغيلية — ما تكشف هوية أحد. نحتاجها للتحليل.` });
    const missing = COLS.filter((c) => c.kind === 'pii' && !st.sensitive.includes(c.id));
    if (missing.length) return setFb({ kind: 'hint', text: `فيه ${missing.length} عمود باقي يكشف هوية شخص بشكل مباشر. فكّر: لو تسرّب هذا العمود، هل يقدر أحد يوصل للعميل؟` });
    set({ step: 1 });
    setFb(null);
  };

  const flip = (r: Role, a: Asset) => set({ matrix: { ...st.matrix, [r]: { ...st.matrix[r], [a]: !st.matrix[r][a] } } });
  const matrixIssue = () => {
    for (const r of ROLES) for (const a of ASSETS) {
      const rule = RULES[`${r.id}.${a.id}`];
      if (rule && st.matrix[r.id][a.id] !== rule.need) return { r, a, rule };
    }
    return null;
  };
  const checkMatrix = () => {
    const issue = matrixIssue();
    if (issue) setFb({ kind: 'hint', text: `${issue.r.label} ← ${issue.a.label}: ${issue.rule.why}` });
    else {
      set({ step: 2 });
    }
  };

  const qOpts: { k: QFix; t: string; fb: { kind: FeedbackKind; text: string } }[] = [
    { k: 'keep', t: 'نتركها مثل ما هي — البيانات هي البيانات', fb: { kind: 'hint', text: 'المطعم مقفل الساعة 3 الفجر، و950 طلب رقم مستحيل، و«-4 طلبات» ما لها معنى أصلًا. لو دخلت التدريب بتخرب النموذج واللوحة.' } },
    { k: 'delete', t: 'نحذفها بهدوء ونكمل', fb: { kind: 'hint', text: 'قريب — لازم ما تدخل التحليل. لكن الحذف الصامت يخفي المشكلة، وبتتكرر من نفس المصدر بدون ما أحد يعرف.' } },
    { k: 'flag', t: 'نعلّمها كخطأ، نستبعدها من التدريب، نبلّغ صاحب المصدر، ونضيف قاعدة تحقق', fb: { kind: 'success', text: 'هذا تفكير الحوكمة: نحمي النموذج، نحافظ على أثر المشكلة، نعالج السبب من جذوره، ونمنع تكرارها تلقائيًا.' } },
    { k: 'invent', t: 'نعدّلها لأرقام معقولة من عندنا', fb: { kind: 'hint', text: 'تأليف أرقام بدون أساس يضر بالثقة في البيانات كلها. التقدير الموثّق (مثل محطة الهندسة) يختلف عن التخمين.' } },
  ];

  // the audit of the participant's REAL decisions across all stations
  const issues: Issue[] = [
    ...project.audit,
    ...STATIONS.filter((s) => s.id !== 'gov' && fixAwaitingDecision(state.station[s.id])).map((s) => ({
      id: `pending-${s.id}`,
      station: s.id,
      severity: 'critical' as const,
      title: `قرار ينتظر إعادة الاختيار في ${s.ar}`,
      detail: `رجعت لمحطة ${s.ar} عشان تصلّح «${fixAwaitingDecision(state.station[s.id])!.title}» — بس ما اخترت القرار الجديد للحين.`,
      hint: 'ارجع للمحطة واختر القرار من جديد.',
    })),
    ...(st.ethic && st.ethic !== 'consent' ? [{ id: 'gov-ethic', station: 'gov' as StationId, severity: 'critical' as const, fixStep: 3, title: 'قرار مشاركة أرقام العملاء بدون موافقتهم', detail: 'مخالف لنظام حماية البيانات الشخصية.' }] : []),
  ];
  const critical = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const allReviewed = !critical.length && warnings.every((w) => st.acks.includes(w.id)) && st.disclaimer;
  const fix = (i: Issue) => {
    if (i.station === 'gov') return set({ step: 3, ethic: null });
    if (i.id.startsWith('pending-')) return go(i.station);
    dispatch({ type: 'patchStation', id: i.station, patch: { step: i.fixStep ?? 0, ...FIX_PATCH[i.id], govFix: { id: i.id, title: i.title, hint: i.hint ?? '', keys: Object.keys(FIX_PATCH[i.id] ?? {}) } } });
    go(i.station);
  };
  const cleanStations = STATIONS.filter((s) => !issues.some((i) => i.station === s.id));

  const finish = () => {
    dispatch({ type: 'complete', id: 'gov', output: { sensitive: st.sensitive, approved: true } });
    go(nextAfter('gov'));
  };

  return (
    <StationShell meta={meta}>
      <div className="rounded-2xl bg-white border border-ink-200 p-4 flex gap-3 items-start text-[15px]">
        <span className="shrink-0 mt-0.5" style={{ color: meta.color }}>
          <Icon name="shield" />
        </span>
        <p className="text-ink-700">
          النظام شبه جاهز للإطلاق. قبل ما يوصل للناس، مختصة الحوكمة تراجعه. تذكّر: لمسات الحوكمة كانت معك من المحطة الأولى — هنا نجمعها ونكمّل الناقص.
        </p>
      </div>

      <Step n={1} reached={st.step} title="حدّد البيانات الحساسة" instruction="هذه بيانات خام من تطبيق التوصيل. اضغط على رؤوس الأعمدة اللي تكشف هوية العميل (بيانات شخصية)، ثم «تحقق».">
        <div className="overflow-x-auto rounded-xl border border-ink-200">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr>
                {COLS.map((c) => {
                  const on = st.sensitive.includes(c.id);
                  return (
                    <th key={c.id} className="p-1.5 border-b border-ink-200 bg-ink-50">
                      <button
                        disabled={st.step !== 0}
                        onClick={() => toggleCol(c.id)}
                        aria-pressed={on}
                        className={cx('w-full rounded-lg px-2 py-1.5 text-right transition border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500', on ? 'bg-rose-50 border-rose-300 text-rose-800' : 'border-transparent hover:border-ink-300')}
                      >
                        <div className="font-bold flex items-center gap-1">
                          {on && <Icon name="lock" size={12} />}
                          {c.label}
                        </div>
                        <bdi dir="ltr" className="text-[10px] font-mono text-ink-400">
                          {c.en}
                        </bdi>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.order_id} className="border-b border-ink-100 last:border-0">
                  {COLS.map((c) => {
                    const v = r[c.id as keyof typeof r];
                    const masked = st.step >= 1 && st.sensitive.includes(c.id);
                    return (
                      <td key={c.id} className={cx('px-3 py-2 whitespace-nowrap', masked && 'text-ink-400 font-mono')}>
                        {masked ? mask(c.id, v) : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3">
          {fb && st.step === 0 && <Feedback kind={fb.kind}>{fb.text}</Feedback>}
          {st.step >= 1 && (
            <Feedback kind="success">
              صح. الاسم والجوال والعنوان بيانات شخصية — صارت <b>مقنّعة</b> <En>Masked</En> لكل من لا يحتاجها.{' '}
              {st.sensitive.includes('district') ? 'وصنّفت الحي كحساس أيضًا — قرار حذر ومقبول.' : 'الحي وحده عام، لكن ننتبه لو اجتمع مع بيانات أخرى.'}
            </Feedback>
          )}
          {st.step === 0 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={!st.sensitive.length} why="اضغط على عناوين الأعمدة الحساسة" onClick={checkCols}>
                تحقق
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={2} skipped={skipped(2)} reached={st.step} title="وزّع الصلاحيات حسب الدور" instruction="حاليًا كل الفريق يشوف كل شي! اضغط على الخانات لتفتح ✓ أو تغلق ✕ الوصول، ثم «تحقق».">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th />
                {ASSETS.map((a) => (
                  <th key={a.id} className="font-semibold text-ink-600 text-xs px-1 pb-1 align-bottom">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.id}>
                  <th className="text-right font-bold pe-2 whitespace-nowrap">{r.label}</th>
                  {ASSETS.map((a) => {
                    const on = st.matrix[r.id][a.id];
                    return (
                      <td key={a.id} className="p-0">
                        <button
                          disabled={st.step !== 1}
                          onClick={() => flip(r.id, a.id)}
                          aria-label={`${r.label} — ${a.label}: ${on ? 'مسموح' : 'ممنوع'}`}
                          aria-pressed={on}
                          className={cx(
                            'w-full h-11 rounded-lg grid place-items-center font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600',
                            on ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-rose-50 text-rose-500 hover:bg-rose-100',
                          )}
                        >
                          <Icon name={on ? 'check' : 'x'} size={18} stroke={3} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3">
          {fb && st.step === 1 && <Feedback kind={fb.kind}>{fb.text}</Feedback>}
          {st.step > 1 && <Feedback kind="success">صلاحيات سليمة! كل دور يشوف اللي يحتاجه لعمله فقط — مبدأ «أقل صلاحية لازمة» (Least Privilege).</Feedback>}
          {st.step === 1 && (
            <div className="flex justify-end">
              <Button variant="accent" onClick={checkMatrix}>
                تحقق
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={3} skipped={skipped(3)} reached={st.step} title="عالج مشكلة جودة" instruction="وصلت دفعة بيانات جديدة لهذا الأسبوع. فيها شي غريب — كيف نتعامل معه؟">
        <div className="rounded-xl border border-ink-200 overflow-hidden mb-4 text-sm font-mono" dir="ltr">
          {[
            ['Tue', '20:00', '41', false],
            ['Tue', '03:00', '950', true],
            ['Wed', '13:00', '27', false],
            ['Wed', '20:00', '-4', true],
          ].map(([d, h, o, bad]) => (
            <div key={`${d}${h}`} className={cx('grid grid-cols-3 px-4 py-2 border-b border-ink-100 last:border-0', bad && 'bg-rose-50 text-rose-700 font-bold')}>
              <span>{d as string}</span>
              <span>{h as string}</span>
              <span>{o as string} orders</span>
            </div>
          ))}
        </div>
        <div className="space-y-2.5">
          {qOpts.map((q) => (
            <OptionCard key={q.k} selected={st.qfix === q.k} state={st.qfix === q.k ? (q.k === 'flag' ? 'right' : 'wrong') : null} disabled={st.step !== 2} onClick={() => set({ qfix: q.k })}>
              {q.t}
            </OptionCard>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {st.qfix && <Feedback kind={qOpts.find((q) => q.k === st.qfix)!.fb.kind}>{qOpts.find((q) => q.k === st.qfix)!.fb.text}</Feedback>}
          {st.qfix === 'flag' && (
            <div className="rounded-xl bg-ink-950 text-ink-100 p-4 font-mono text-xs animate-rise" dir="ltr">
              <div className="text-emerald-400 mb-1"># new data-quality rules → added to the pipeline (station 1)</div>
              <div>assert 0 &lt;= orders &lt;= 200</div>
              <div>assert 12 &lt;= hour &lt;= 23 # opening hours</div>
              <div>on_fail: quarantine_row(), notify(owner="delivery_app_team")</div>
            </div>
          )}
          {st.step === 2 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={st.qfix !== 'flag'} why="اختر الحل الأنسب لمشكلة الجودة" onClick={() => set({ step: 3 })} iconEnd="arrow">
                التالي: قرار صعب
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={4} reached={st.step} title="قرار أخلاقي: نبيع الأرقام؟" instruction="أم فهد وصلها عرض مغري. وش تنصحها؟">
        <div className="flex items-end gap-3 mb-4">
          <Avatar c={OWNER} size={56} className="shrink-0" />
          <div className="rounded-2xl rounded-br-sm bg-ink-50 border border-ink-200 px-4 py-3 text-[15px] leading-relaxed">
            <div className="text-xs font-bold text-ink-500 mb-0.5">{OWNER.name}</div>
            شركة إعلانات تبي أرقام جوالات عملائنا، وبتدفع لنا 15,000 ريال! البيانات عندنا أصلًا… نبيعها؟
          </div>
        </div>
        <div className="space-y-2.5">
          {ETHICS.map((e) => (
            <OptionCard key={e.k} selected={st.ethic === e.k} state={st.ethic === e.k ? (e.k === 'consent' ? 'right' : 'wrong') : null} disabled={st.step !== 3} onClick={() => set({ ethic: e.k })}>
              {e.t}
            </OptionCard>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {st.ethic && st.ethic !== 'consent' && <Feedback kind="warn">{ETHICS.find((e) => e.k === st.ethic)!.fb}</Feedback>}
          {st.ethic === 'consent' && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 animate-rise">
              <div className="font-bold text-green-900 mb-2">✓ قرار صحيح ونظامي. وهذا ليش:</div>
              <ul className="space-y-1.5 text-[15px] text-green-950">
                <li>
                  • في السعودية فيه <b>نظام حماية البيانات الشخصية</b> <En>PDPL</En> صدر بالمرسوم الملكي (م/19)، وتشرف على تطبيقه <b>سدايا</b>.
                </li>
                <li>• استخدام البيانات للتسويق المباشر يحتاج <b>موافقة صريحة</b> من صاحبها — والعميل أعطانا رقمه عشان التوصيل، مو للإعلانات.</li>
                <li>• العميل يقدر <b>يسحب موافقته</b> في أي وقت.</li>
                <li>• سدايا أصدرت فعلًا غرامات وإنذارات على جهات سوّقت لأشخاص بدون موافقتهم الصريحة.</li>
              </ul>
              <p className="text-xs text-green-800 mt-3">تبسيط تعليمي وليس استشارة قانونية — للتفاصيل ارجع للنظام ولوائحه على موقع سدايا.</p>
            </div>
          )}
          {st.step === 3 && (
            <div className="flex justify-end">
              <Button variant="accent" disabled={!st.ethic} why="اختر قرارك" onClick={() => set({ step: 4 })} iconEnd="arrow">
                التالي: المراجعة النهائية
              </Button>
            </div>
          )}
        </div>
      </Step>

      <Step n={5} reached={st.step} title="راجع قرارات الفريق الفعلية" instruction="الحوكمة تفحص اللي صار فعلًا في المشروع — قراراتك أنت في كل محطة. المشاكل الحرجة لازم تنصلح، والتحذيرات لازم توثَّق.">
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className={cx('rounded-xl p-3 border', critical.length ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200')}>
            <div className="text-2xl font-bold tabular-nums">{critical.length}</div>
            <div className="text-xs text-ink-600">مشاكل حرجة</div>
          </div>
          <div className="rounded-xl p-3 border bg-amber-50 border-amber-200">
            <div className="text-2xl font-bold tabular-nums">{warnings.length}</div>
            <div className="text-xs text-ink-600">تحذيرات</div>
          </div>
          <div className="rounded-xl p-3 border bg-ink-50 border-ink-200">
            <div className="text-2xl font-bold tabular-nums">{issues.filter((i) => i.severity === 'info').length}</div>
            <div className="text-xs text-ink-600">ملاحظات</div>
          </div>
        </div>
        <p className="text-sm text-ink-600 mb-3 rounded-lg bg-ink-50 px-3 py-2">
          <b>كيف تعتمد النظام؟</b> المشاكل <b className="text-rose-700">الحرجة</b> لازم تنصلح. <b className="text-amber-700">التحذيرات</b> عندك خيارين: تصلحها، أو تحط صح على «أوثّق هذا الخطر» — والاثنين يكفون. الملاحظات للعلم فقط.
        </p>
        <ul className="space-y-2.5">
          {issues.map((i) => {
            const s = STATIONS.find((x) => x.id === i.station)!;
            const acked = st.acks.includes(i.id);
            return (
              <li key={i.id} className={cx('rounded-xl border-2 p-3', i.severity === 'critical' ? 'border-rose-300 bg-rose-50' : i.severity === 'warning' ? (acked ? 'border-amber-200 bg-white' : 'border-amber-300 bg-amber-50') : 'border-ink-200 bg-white')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cx('text-xs font-bold rounded-md px-2 py-0.5', i.severity === 'critical' ? 'bg-rose-600 text-white' : i.severity === 'warning' ? 'bg-amber-500 text-white' : 'bg-ink-200 text-ink-700')}>
                    {i.severity === 'critical' ? 'حرج' : i.severity === 'warning' ? 'تحذير' : 'ملاحظة'}
                  </span>
                  <span className="text-xs font-bold rounded-md px-2 py-0.5 text-white" style={{ background: s.color }}>
                    {s.ar}
                  </span>
                  <span className="font-bold flex-1 min-w-[180px]">{i.title}</span>
                </div>
                <p className="text-sm text-ink-700 mt-1.5">{i.detail}</p>
                {i.hint && i.severity !== 'info' && (
                  <p className="text-sm mt-1.5 rounded-lg bg-white/70 px-2.5 py-1.5">
                    <b>🔧 للإصلاح: </b>
                    {i.hint}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {i.severity !== 'info' && (
                    <Button size="sm" variant={i.severity === 'critical' ? 'accent' : 'secondary'} disabled={st.step !== 4} onClick={() => fix(i)}>
                      ارجع وصلّح في {s.ar}
                    </Button>
                  )}
                  {i.severity === 'warning' && (
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" disabled={st.step !== 4} checked={acked} onChange={() => set({ acks: acked ? st.acks.filter((x) => x !== i.id) : [...st.acks, i.id] })} />
                      <span>
                        <b>أوثّق هذا الخطر وأقبله</b> <span className="text-ink-500">(يكفي عشان تكمل بدون إصلاح)</span>
                      </span>
                    </label>
                  )}
                </div>
              </li>
            );
          })}
          <li className={cx('rounded-xl border-2 p-3', st.disclaimer ? 'border-emerald-300 bg-emerald-50/60' : 'border-amber-300 bg-amber-50')}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold rounded-md px-2 py-0.5 text-white" style={{ background: STATIONS[4].color }}>
                {STATIONS[4].ar}
              </span>
              <span className="flex-1">لوحة المعلومات توضّح أن الأرقام توقعات تقديرية وليست ضمانات</span>
              {!st.disclaimer ? (
                <Button size="sm" variant="accent" disabled={st.step !== 4} onClick={() => set({ disclaimer: true })}>
                  أضف التنبيه للوحة
                </Button>
              ) : (
                <span className="text-sm text-emerald-800">✓ أُضيف</span>
              )}
            </div>
          </li>
        </ul>
        {cleanStations.length > 0 && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm">
            <b className="text-emerald-900">✓ بدون ملاحظات:</b>{' '}
            {cleanStations.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 me-2">
                {s.ar}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 space-y-3">
          <Feedback kind="info">{meta.govNote} وكل رقم في هذه المراجعة محسوب من مشروعك أنت — لو صلّحت قرارًا، تتحدث المراجعة تلقائيًا.</Feedback>
          {st.step === 4 && (
            <div className="flex justify-end items-center gap-3 flex-wrap">
              {!allReviewed && (
                <span className="text-sm text-ink-600">
                  {critical.length
                    ? `باقي ${critical.length} مشكلة حرجة لازم تنصلح`
                    : [warnings.filter((w) => !st.acks.includes(w.id)).length ? `باقي ${warnings.filter((w) => !st.acks.includes(w.id)).length} تحذير: صلّحه أو حط صح على «أوثّق»` : '', !st.disclaimer ? 'أضف تنبيه اللوحة' : ''].filter(Boolean).join(' · ')}
                </span>
              )}
              <Button variant="accent" icon="shield" disabled={!allReviewed} onClick={() => set({ step: 5 })}>
                اعتمد النظام للإطلاق
              </Button>
            </div>
          )}
        </div>
      </Step>

      {st.step >= 5 && (
        <StationOutro
          meta={meta}
          onContinue={finish}
          nextLabel={nextLabelFor('gov')}
          output={
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="grid place-items-center w-12 h-12 rounded-full bg-white text-green-600">
                  <Icon name="shield" size={26} />
                </span>
                <div className="text-2xl font-bold">نظام معتمد من الحوكمة</div>
              </div>
              <ul className="text-white/85 space-y-1">
                <li>• {COLS.filter((c) => st.sensitive.includes(c.id)).length} أعمدة شخصية مقنّعة</li>
                <li>• صلاحيات حسب الدور لـ {ROLES.length} أدوار</li>
                <li>• قاعدتا جودة تلقائيتان في أنبوب البيانات</li>
                <li>• رفض بيع بيانات العملاء — التزامًا بنظام حماية البيانات الشخصية</li>
                <li>• مراجعة قرارات المحطات الست: {issues.length ? `${warnings.length} تحذير موثّق، ${issues.filter((i) => i.severity === 'info').length} ملاحظة` : 'بدون ملاحظات'}</li>
              </ul>
            </div>
          }
        />
      )}
    </StationShell>
  );
}
