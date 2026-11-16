import { CSSProperties } from 'react';
import { ROADMAPS, STATIONS, StationMeta } from '../data/stations';
import { useProject } from '../data/project';
import { earnedAchievements } from '../components/Achievements';
import { useState } from 'react';
import { StationId, useStore } from '../state/store';
import { Icon } from '../components/Icon';
import { Button, Card, cx } from '../components/ui';

export const TASKS: { id: StationId; text: string }[] = [
  { id: 'de', text: 'تنظيف الجدول الفوضوي ودمج المصدرين' },
  { id: 'da', text: 'استكشاف الرسوم واكتشاف أوقات الذروة' },
  { id: 'ds', text: 'التحقيق في العوامل وكشف أن الارتباط ليس سببية' },
  { id: 'ml', text: 'اختيار الكود وتدريب النموذج ورؤية نتائجه' },
  { id: 'bi', text: 'تصميم لوحة المعلومات واتخاذ قرار منها' },
  { id: 'gov', text: 'حماية البيانات الحساسة وتوزيع الصلاحيات' },
];
const SCALE = ['ما شدّني', 'عادي', 'حلو', 'عجبني', 'استمتعت جدًا'];
export const PICKS: { id: string; q: string; a: { t: string; tracks: StationId[] }; b: { t: string; tracks: StationId[] } }[] = [
  { id: 'p1', q: 'تستمتع أكثر بـ…', a: { t: 'اكتشاف الأنماط في البيانات', tracks: ['da', 'ds'] }, b: { t: 'بناء أنظمة تشتغل', tracks: ['de', 'ml'] } },
  { id: 'p2', q: 'تفضّل…', a: { t: 'استكشاف البيانات وطرح الأسئلة', tracks: ['da', 'ds'] }, b: { t: 'تصميم حلول يستخدمها الناس', tracks: ['bi', 'ml'] } },
  { id: 'p3', q: 'أكثر شي يحمّسك…', a: { t: 'أتوقع اللي بيصير', tracks: ['ds', 'ml'] }, b: { t: 'أعرض النتائج وأساعد في القرار', tracks: ['bi', 'da'] } },
  { id: 'p4', q: 'تحب يكون شغلك…', a: { t: 'تنفيذ تقني وبرمجة', tracks: ['de', 'ml'] }, b: { t: 'تنظيم المعلومات ووضع القواعد', tracks: ['gov', 'bi'] } },
  { id: 'p5', q: 'لما تواجه مشكلة…', a: { t: 'أجرّب حلول وأقارن نتائجها', tracks: ['ds', 'ml'] }, b: { t: 'أتأكد أن كل شي صحيح وموثّق قبل ما أكمل', tracks: ['gov', 'de'] } },
];

/** Things the participant actually did during the journey (light weight, always explained). */
export interface Signals {
  achievements: StationId[];
  explored: StationId[];
  ramadan: boolean;
}
const ACH_STATION: Record<string, StationId> = { detective: 'de', cleaner: 'de', explorer: 'da', selector: 'ds', builder: 'ml', decider: 'bi', guardian: 'gov' };
export const signalsFrom = (earned: string[], explored: string[], ramadan: boolean): Signals => ({
  achievements: earned.filter((e) => ACH_STATION[e]).map((e) => ACH_STATION[e]),
  explored: explored as StationId[],
  ramadan,
});

const MAX_SCORE = 10 + 3 * 1.5 + 2 + 1 + 1; // rating + up to 3 picks + achievements + explored + challenge

export function computeScores(ratings: Record<string, number>, picks: Record<string, string>, sig: Signals = { achievements: [], explored: [], ramadan: false }) {
  const score: Record<StationId, number> = { de: 0, da: 0, ds: 0, ml: 0, bi: 0, gov: 0 };
  const reasons: Record<StationId, string[]> = { de: [], da: [], ds: [], ml: [], bi: [], gov: [] };
  TASKS.forEach((t) => {
    const r = ratings[t.id];
    if (r != null) {
      score[t.id] += (r + 1) * 2;
      if (r >= 3) reasons[t.id].push(`قيّمت «${t.text}» بـ«${SCALE[r]}»`);
    }
  });
  PICKS.forEach((p) => {
    const choice = picks[p.id] === 'a' ? p.a : picks[p.id] === 'b' ? p.b : null;
    choice?.tracks.forEach((tr) => {
      score[tr] += 1.5;
      reasons[tr].push(`اخترت «${choice.t}»`);
    });
  });
  (Object.keys(score) as StationId[]).forEach((id) => {
    const n = sig.achievements.filter((a) => a === id).length;
    if (n) {
      score[id] += Math.min(2, n);
      reasons[id].push('أبدعت في مهام هذه المحطة (إنجاز مكتسب)');
    }
    if (sig.explored.includes(id)) {
      score[id] += 1;
      reasons[id].push('فتحت «استكشف أكثر» بدافع الفضول');
    }
  });
  if (sig.ramadan) {
    score.ml += 1;
    reasons.ml.push('أكملت تحدي رمضان (إعادة تدريب نموذج)');
  }
  const ranked = (Object.keys(score) as StationId[]).sort((a, b) => score[b] - score[a]);
  const fit = (id: StationId) => Math.min(100, Math.round((score[id] / MAX_SCORE) * 100));
  return { score, reasons, ranked, fit };
}

export function CareerDiscovery() {
  const { state, dispatch, go } = useStore();
  const project = useProject();
  const { ratings, picks } = state.career;
  const allRated = TASKS.every((t) => ratings[t.id] != null);
  const allPicked = PICKS.every((p) => picks[p.id]);
  const ready = allRated && allPicked;
  const sig = signalsFrom(earnedAchievements(state, project), state.explored ?? [], !!state.boss.done);
  const { reasons, ranked, fit } = computeScores(ratings, picks, sig);
  const top = ranked.slice(0, 3);
  const [cmp, setCmp] = useState<[StationId, StationId] | null>(null);
  const pair = cmp ?? [top[0], top[1]];

  const setRating = (id: string, v: number) => dispatch({ type: 'career', patch: { ratings: { ...ratings, [id]: v } } });
  const setPick = (id: string, v: string) => dispatch({ type: 'career', patch: { picks: { ...picks, [id]: v } } });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 pb-24">
      <div className="text-sm font-semibold text-ink-500 mb-2">اكتشف مسارك</div>
      <h1 className="text-3xl sm:text-4xl font-bold">وش أكثر شي استمتعت فيه؟</h1>
      <p className="text-lg text-ink-600 mt-3 max-w-2xl">ما فيه إجابات صح وغلط هنا — نسألك عن تفضيلاتك وأسلوبك في العمل. وناخذ بعين الاعتبار بشكل خفيف وش سويت في الرحلة.</p>

      <Card className="p-5 sm:p-6 mt-8">
        <h2 className="font-bold text-xl mb-1">1. قيّم المهام اللي جربتها</h2>
        <p className="text-ink-500 text-sm mb-5">كم استمتعت بكل مهمة؟</p>
        <ul className="space-y-5">
          {TASKS.map((t) => {
            const s = STATIONS.find((x) => x.id === t.id)!;
            return (
              <li key={t.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="font-medium">{t.text}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={t.text}>
                  {SCALE.map((label, i) => {
                    const on = ratings[t.id] === i;
                    return (
                      <button
                        key={label}
                        role="radio"
                        aria-checked={on}
                        onClick={() => setRating(t.id, i)}
                        className={cx(
                          'rounded-lg border-2 py-2 text-xs sm:text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200',
                          on ? 'text-white' : 'border-ink-200 hover:border-ink-400 text-ink-600',
                        )}
                        style={on ? { background: s.color, borderColor: s.color } : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-5 sm:p-6 mt-5">
        <h2 className="font-bold text-xl mb-5">2. أسلوبك في العمل</h2>
        <div className="space-y-5">
          {PICKS.map((p) => (
            <div key={p.id}>
              <div className="font-medium mb-2">{p.q}</div>
              <div className="grid sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label={p.q}>
                {(['a', 'b'] as const).map((k) => (
                  <button
                    key={k}
                    role="radio"
                    aria-checked={picks[p.id] === k}
                    onClick={() => setPick(p.id, k)}
                    className={cx(
                      'rounded-xl border-2 px-4 py-3 text-right transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200',
                      picks[p.id] === k ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 hover:border-ink-400',
                    )}
                  >
                    {p[k].t}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {!ready && (
        <p className="text-center text-ink-500 mt-6 text-sm">
          جاوب على كل البنود عشان تظهر اقتراحاتك ({Object.keys(ratings).length + Object.keys(picks).filter((k) => PICKS.some((p) => p.id === k)).length}/{TASKS.length + PICKS.length})
        </p>
      )}

      {ready && (
        <div className="mt-10 animate-rise" aria-live="polite">
          <h2 className="text-2xl font-bold mb-1">أقرب 3 مسارات لاهتماماتك</h2>
          <p className="text-ink-600 mb-2">بناءً على تفضيلاتك أنت — وموضّح ليش اقترحناها.</p>
          <p className="text-sm text-ink-500 mb-5">«نسبة التوافق» تقيس مدى تطابق المسار مع ما قلته عن نفسك في هذه التجربة فقط. ليست احتمال نجاح ولا تقييمًا علميًا معتمدًا.</p>
          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            {top.map((id, i) => {
              const m = STATIONS.find((s) => s.id === id)!;
              return (
                <div key={id} className="rounded-2xl border-2 p-4" style={{ borderColor: i === 0 ? m.color : '#DCE0EE' }}>
                  <div className="text-xs font-bold" style={{ color: m.color }}>
                    {i === 0 ? 'الأقرب' : i === 1 ? 'الثاني' : 'الثالث'}
                  </div>
                  <div className="font-bold text-lg">{m.ar}</div>
                  <div className="mt-2 h-2.5 bg-ink-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${fit(id)}%`, background: m.color }} />
                  </div>
                  <div className="text-sm mt-1 tabular-nums">توافق مع تفضيلاتك: {fit(id)}%</div>
                  <div className="text-xs text-ink-500 mt-1">{FOCUS[id]}</div>
                </div>
              );
            })}
          </div>
          <div className="space-y-4">
            {top.map((id, i) => (
              <TrackCard key={id} meta={STATIONS.find((s) => s.id === id)!} rank={i} reasons={reasons[id]} onRevisit={() => go(id)} />
            ))}
          </div>
          <Compare pair={pair} setPair={setCmp} score={fit} />
          <details className="mt-5 rounded-xl border border-ink-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold text-sm">كيف حسبنا الاقتراح؟</summary>
            <p className="text-sm text-ink-600 mt-2">
              كل تقييم يعطي نقاطًا للمسار المرتبط بالمهمة (من 2 إلى 10)، وكل اختيار في أسلوب العمل يضيف 1.5 نقطة لمسارين، والإنجازات المكتسبة و«استكشف أكثر» تضيف نقاطًا قليلة. هذي النتيجة الكاملة:
            </p>
            <ul className="mt-3 space-y-1.5">
              {ranked.map((id) => {
                const s = STATIONS.find((x) => x.id === id)!;
                return (
                  <li key={id} className="flex items-center gap-2 text-sm">
                    <span className="w-32 shrink-0">{s.ar}</span>
                    <div className="flex-1 h-2.5 bg-ink-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${fit(id)}%`, background: s.color }} />
                    </div>
                    <span className="w-12 tabular-nums text-ink-500">{fit(id)}%</span>
                  </li>
                );
              })}
            </ul>
          </details>
          <div className="mt-5 rounded-xl bg-ink-50 border border-ink-200 p-4 text-sm text-ink-600 flex gap-2">
            <Icon name="bulb" size={18} className="shrink-0 mt-0.5" />
            هذا اقتراح استكشافي مبني على {TASKS.length + PICKS.length} إجابة عن تفضيلاتك في هذه التجربة — وليس اختبار قدرات أو تقييمًا مهنيًا معتمدًا. المسارات متداخلة كثيرًا، وأفضل طريقة تكتشف بها نفسك: جرّب وتعلّم أكثر.
          </div>
          <div className="flex justify-end mt-6">
            <Button
              size="lg"
              iconEnd="arrow"
              onClick={() => {
                dispatch({ type: 'career', patch: { done: true } });
                dispatch({ type: 'set', patch: { finishedAt: state.finishedAt ?? Date.now() } });
                go('done');
              }}
            >
              أنهِ الرحلة
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackCard({ meta, rank, reasons, onRevisit }: { meta: StationMeta; rank: number; reasons: string[]; onRevisit: () => void }) {
  return (
    <Card className="overflow-hidden" style={{ '--accent': meta.color } as CSSProperties}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-12 h-12 rounded-xl text-white shrink-0" style={{ background: meta.color }}>
            <Icon name={meta.icon} size={24} />
          </span>
          <div className="flex-1">
            <div className="text-xs font-bold" style={{ color: meta.color }}>
              {rank === 0 ? 'الأقرب لاهتماماتك' : 'خيار قريب أيضًا'}
            </div>
            <h3 className="text-2xl font-bold">{meta.ar}</h3>
            <bdi dir="ltr" className="text-sm text-ink-500 font-mono">
              {meta.en}
            </bdi>
          </div>
        </div>
        {reasons.length > 0 && (
          <div className="mt-4 rounded-xl px-4 py-3" style={{ background: meta.soft }}>
            <div className="text-sm font-bold mb-1">ليش اقترحناه؟</div>
            <ul className="text-sm space-y-0.5">
              {reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-sm font-bold text-ink-500 mb-1.5">مسؤوليات نموذجية</div>
            <ul className="text-[15px] space-y-1">
              {meta.dayToDay.map((d) => (
                <li key={d}>• {d}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-sm font-bold text-ink-500 mb-1.5">ابدأ تتعلم</div>
            <ul className="text-[15px] space-y-1">
              {meta.beginnerTopics.map((d) => (
                <li key={d}>• {d}</li>
              ))}
            </ul>
          </div>
        </div>
        <RoadmapView id={meta.id} color={meta.color} soft={meta.soft} />
        <div className="mt-4">
          <Button variant="secondary" size="sm" icon="arrowBack" onClick={onRevisit}>
            ارجع لمحطة {meta.ar}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RoadmapView({ id, color, soft }: { id: StationMeta['id']; color: string; soft: string }) {
  const r = ROADMAPS[id];
  const Link = ({ l }: { l: { name: string; url: string; note: string } }) => (
    <li>
      <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4 decoration-2" style={{ textDecorationColor: color }}>
        {l.name}
      </a>
      <div className="text-sm text-ink-500">{l.note}</div>
    </li>
  );
  return (
    <div className="mt-5 rounded-2xl border-2 p-4 sm:p-5" style={{ borderColor: soft }}>
      <div className="font-bold text-lg mb-3">🗺️ وش أسوي بكرة؟ خارطة طريق للبداية</div>
      <ol className="grid sm:grid-cols-2 gap-4">
        <li>
          <div className="text-sm font-bold mb-1" style={{ color }}>
            1. أول أسابيع: تعلّم هذي
          </div>
          <ul className="text-[15px] space-y-1">
            {r.firstWeeks.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        </li>
        <li>
          <div className="text-sm font-bold mb-1" style={{ color }}>
            2. مصادر مجانية تبدأ فيها اليوم
          </div>
          <ul className="space-y-2">
            {r.free.map((l) => (
              <Link key={l.name} l={l} />
            ))}
          </ul>
        </li>
        <li>
          <div className="text-sm font-bold mb-1" style={{ color }}>
            3. برامج سعودية تتابعها
          </div>
          <ul className="space-y-2">
            {r.saudi.map((l) => (
              <Link key={l.name} l={l} />
            ))}
          </ul>
        </li>
        <li>
          <div className="text-sm font-bold mb-1" style={{ color }}>
            4. أول مشروع لك
          </div>
          <p className="text-[15px]">{r.firstProject}</p>
          <div className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold" style={{ background: soft, color }}>
            ⏱ {r.time}
          </div>
        </li>
      </ol>
      <p className="text-xs text-ink-500 mt-3">البرامج ومواعيد التسجيل تتغير — تأكد من مواقعها الرسمية. المدد تقديرية وتختلف حسب وقتك.</p>
    </div>
  );
}

const FOCUS: Record<StationId, string> = {
  de: 'يبني الأساس: يجمع وينظف ويجهز البيانات.',
  da: 'يحوّل البيانات لإجابات: متى؟ كم؟ أين؟',
  ds: 'يحقق في الأسباب ويصمم طريقة التنبؤ.',
  ml: 'يبني النموذج ويشغّله ويراقبه.',
  bi: 'يحوّل الأرقام لقرارات ولوحات للإدارة.',
  gov: 'يضمن أن البيانات موثوقة ومحمية ونظامية.',
};

function Compare({ pair, setPair, score }: { pair: [StationId, StationId]; setPair: (p: [StationId, StationId]) => void; score: (id: StationId) => number }) {
  const [a, b] = pair.map((id) => STATIONS.find((s) => s.id === id)!);
  const sel = (i: 0 | 1, v: StationId) => setPair(i === 0 ? [v, pair[1]] : [pair[0], v]);
  const rows: [string, (m: StationMeta) => React.ReactNode][] = [
    ['التركيز', (m) => FOCUS[m.id]],
    ['مهام يومية', (m) => m.dayToDay.slice(0, 3).join('، ')],
    ['مهارات للبداية', (m) => m.beginnerTopics.join('، ')],
    ['أدوات', (m) => <bdi dir="ltr">{m.tools.join(' · ')}</bdi>],
    ['وقت البداية تقريبًا', (m) => ROADMAPS[m.id].time],
    ['أول مشروع', (m) => ROADMAPS[m.id].firstProject],
    ['توافقك', (m) => `${score(m.id)}%`],
  ];
  return (
    <Card className="p-5 sm:p-6 mt-6">
      <h2 className="font-bold text-xl mb-3">قارن مسارين جنبًا إلى جنب</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {([0, 1] as const).map((i) => (
          <label key={i} className="text-sm font-semibold">
            <span className="sr-only">المسار {i + 1}</span>
            <select value={pair[i]} onChange={(e) => sel(i, e.target.value as StationId)} className="w-full rounded-xl border-2 border-ink-200 px-3 py-2 bg-white">
              {STATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ar}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr>
              <th className="w-32" />
              {[a, b].map((m) => (
                <th key={m.id} className="text-right p-2 font-bold" style={{ color: m.color }}>
                  {m.ar}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([l, f]) => (
              <tr key={l} className="border-t border-ink-100 align-top">
                <th className="text-right p-2 text-ink-500 font-semibold">{l}</th>
                <td className="p-2">{f(a)}</td>
                <td className="p-2">{f(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
