import { CSSProperties, useMemo, useState } from 'react';
import { CHARACTERS, OWNER, STATIONS } from './stations';
import { HOURS, RAMADAN, RAMADAN_TEST, RAMADAN_TRAIN, WEEKDAYS, dateAr, fmtHour, mean, round1, staffFor } from './dataset';
import { ramadanModels } from './model';
import { useStore, AppState } from './store';
import { useProject } from './project';
import { Avatar } from './Avatar';
import { BarChart, LineChart } from './charts';
import { Button, Card, Feedback, cx, En } from './ui';
import { LiveRestaurant } from './LiveRestaurant';

const IFTAR = 18;
const SUHOOR = 23;

export function Ramadan() {
  const { state, dispatch, go } = useStore();
  const boss = state.boss;
  const setBoss = (patch: Partial<AppState['boss']>) => dispatch({ type: 'set', patch: { boss: { ...boss, ...patch } } });
  const project = useProject();
  const R = useMemo(() => ramadanModels(project.run.model, project.clean.rows), [project]);
  const [fb, setFb] = useState<string | null>(null);
  const [hour, setHour] = useState(IFTAR);
  const day1 = RAMADAN.filter((r) => r.day === 100);
  const checkDay = RAMADAN_TEST.filter((r) => r.day === 104);
  const avgR = HOURS.map((h) => round1(mean(RAMADAN_TRAIN.filter((r) => r.hour === h).map((r) => r.orders))));
  const step = boss.step;

  const clickPeak = (i: number) => {
    if (step !== 2) return;
    const h = HOURS[i];
    if (h === IFTAR || h === SUHOOR) {
      const peaks = boss.peaks.includes(h) ? boss.peaks : [...boss.peaks, h];
      setBoss({ peaks });
      setFb(h === IFTAR ? `صح! ${fmtHour(h)} = وقت الفطور. أعلى ساعة في اليوم.` : `صح! من ${fmtHour(h)} يبدأ زحام السحور ويكبر.`);
    } else if (h <= 16) setFb('الظهر في رمضان شبه فاضي — عكس الأيام العادية تمامًا. دوّر على أعلى عمودين.');
    else setFb(`${fmtHour(h)}: ${avgR[i]} طلب. فيه عمودين أعلى — واحد عند المغرب وواحد آخر الليل.`);
  };

  const finish = (skipped = false) => {
    setBoss({ done: !skipped, skipped });
    go('career');
  };

  const predAfter = R.after.predict({ weekday: 4, hour, promo: false, event: false, ramadan: true, staff: 4 });
  const ml = STATIONS.find((s) => s.id === 'ml')!;

  return (
    <div className="pb-28">
      <section className={cx('relative overflow-hidden text-white', step === 0 ? 'bg-rose-950' : 'bg-ink-950')}>
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #ffffff10 0 2px, transparent 2px 4px)' }} />
        <div className="relative max-w-4xl mx-auto px-4 py-10">
          <div className={cx('inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold mb-4', step === 0 ? 'bg-rose-500 animate-pulse' : 'bg-white/10')}>
            🚨 التحدي الأخير · بعد أشهر من الإطلاق
          </div>
          <h1 className={cx('text-3xl sm:text-5xl font-bold', step === 0 && 'glitch')}>دخل رمضان… والنموذج انهار!</h1>
          <div className="mt-6 flex items-end gap-3 max-w-2xl">
            <Avatar c={OWNER} size={64} mood="worried" bg="#ffffff22" className="shrink-0" />
            <div className="rounded-2xl rounded-br-sm bg-white text-ink-900 px-4 py-3 text-[15px] leading-relaxed">
              <div className="text-xs font-bold text-rose-600 mb-0.5">{OWNER.name} · صاحبة المطعم</div>
              أمس الساعة 2 الظهر النظام قال «زحمة» وجهزنا الموظفين… والمطعم فاضي! وعند الفطور انفجر علينا وما لحقنا. وش صار للنموذج؟!
            </div>
          </div>
          {step === 0 && (
            <button onClick={() => finish(true)} className="mt-6 text-sm text-white/60 underline underline-offset-4 hover:text-white">
              ضيق وقت؟ تخطَّ التحدي واذهب لاكتشاف مسارك
            </button>
          )}
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-5">
        {/* 1. the problem */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-xl font-bold mb-1">1. وش المشكلة؟</h2>
          <p className="text-ink-600 mb-4">
            أول يوم رمضان ({dateAr(day1[0].date)}): الخط الأسود الواقع، والمتقطع توقع نموذجنا القديم.
          </p>
          <LineChart
            ariaLabel="توقع النموذج القديم مقابل الواقع في أول يوم رمضان"
            labels={HOURS.map(String)}
            series={[
              { name: 'الواقع في رمضان', values: day1.map((r) => r.orders), color: '#111833' },
              { name: 'توقع النموذج القديم', values: day1.map((r) => round1(R.before.predict(r))), color: '#E11D48', dashed: true },
            ]}
          />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl border border-ink-200 p-3 text-center">
              <div className="text-xs text-ink-500">متوسط الخطأ في الأيام العادية</div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600">±{R.maeNormal.toFixed(1)}</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center">
              <div className="text-xs text-ink-500">متوسط الخطأ في رمضان</div>
              <div className="text-2xl font-bold tabular-nums text-rose-600">±{R.maeBefore.toFixed(1)}</div>
            </div>
          </div>
          <Feedback kind="info" title="هذا اسمه انحراف البيانات (Data Drift)">
            النموذج ما خرب — العالم تغيّر. تدرّب على أيام عادية والذروة فيها 9 مساءً، وفي رمضان صار نمط اليوم كله مختلف. كل نموذج يحتاج مراقبة بعد إطلاقه <En>MLOps</En>.
          </Feedback>
          {step === 0 && (
            <div className="flex justify-end mt-4">
              <Button size="lg" onClick={() => setBoss({ step: 1 })} iconEnd="arrow">
                📣 استدعِ الفريق
              </Button>
            </div>
          )}
        </Card>

        {/* 2. engineer */}
        {step >= 1 && (
          <TeamCard id="de" title="2. مهندس البيانات: نجيب بيانات رمضان">
            <p className="text-ink-700">نضيف أول 4 أيام من رمضان للأنبوب، مع عمود جديد يقول للنموذج «هذا يوم رمضان».</p>
            {step === 1 ? (
              <div className="mt-4">
                <Button variant="accent" icon="play" onClick={() => setBoss({ step: 2 })}>
                  اجلب بيانات رمضان
                </Button>
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-ink-950 text-ink-100 p-3 font-mono text-xs animate-rise" dir="ltr">
                <div className="text-emerald-400">+ {RAMADAN_TRAIN.length} new rows (Ramadan days 1–4)</div>
                <div>+ new column: ramadan = 1</div>
                <div className="text-ink-400"># days 5–7 kept aside to check the fix honestly</div>
              </div>
            )}
          </TeamCard>
        )}

        {/* 3. analyst */}
        {step >= 2 && (
          <TeamCard id="da" title="3. محلل البيانات: وش النمط الجديد؟">
            <p className="text-ink-700 mb-3">متوسط الطلبات لكل ساعة في أول 4 أيام رمضان. اضغط على <b>الذروتين</b>.</p>
            <BarChart
              ariaLabel="متوسط الطلبات في رمضان حسب الساعة"
              values={avgR}
              labels={HOURS.map(String)}
              color={STATIONS[1].color}
              onBarClick={step === 2 ? clickPeak : undefined}
              highlight={boss.peaks.length ? (HOURS as readonly number[]).indexOf(boss.peaks[boss.peaks.length - 1]) : undefined}
              height={200}
            />
            <div className="flex gap-2 mt-3 text-sm">
              {[IFTAR, SUHOOR].map((h) => (
                <span key={h} className={cx('rounded-full px-3 py-1 border', boss.peaks.includes(h) ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'border-ink-200 text-ink-500')}>
                  {boss.peaks.includes(h) ? '✓ ' : ''}
                  {h === IFTAR ? 'ذروة الفطور' : 'ذروة السحور'}
                </span>
              ))}
            </div>
            {fb && step === 2 && (
              <div className="mt-3">
                <Feedback kind={boss.peaks.length ? 'success' : 'hint'}>{fb}</Feedback>
              </div>
            )}
            {step === 2 && (
              <div className="flex justify-end mt-3">
                <Button variant="accent" disabled={boss.peaks.length < 2} why={`حدّد الذروتين (${boss.peaks.length} من 2)`} onClick={() => setBoss({ step: 3 })} iconEnd="arrow">
                  سلّم النمط لمهندس تعلم الآلة
                </Button>
              </div>
            )}
          </TeamCard>
        )}

        {/* 4. ML */}
        {step >= 3 && (
          <TeamCard id="ml" title="4. مهندس تعلم الآلة: نعيد التدريب">
            <p className="text-ink-700">نعيد تدريب النموذج على البيانات القديمة + أيام رمضان الجديدة، مع خاصية «رمضان» لكل ساعة. ثم نختبره على أيام 5–7 اللي ما شافها.</p>
            {step === 3 ? (
              <div className="mt-4">
                <Button variant="accent" icon="play" onClick={() => setBoss({ step: 4 })}>
                  Retrain Model
                </Button>
              </div>
            ) : (
              <div className="animate-rise mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center">
                    <div className="text-xs text-ink-500">الخطأ قبل إعادة التدريب</div>
                    <div className="text-3xl font-bold tabular-nums text-rose-600">±{R.maeBefore.toFixed(1)}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                    <div className="text-xs text-ink-500">الخطأ بعد إعادة التدريب</div>
                    <div className="text-3xl font-bold tabular-nums text-emerald-600">±{R.maeAfter.toFixed(1)}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <LineChart
                    ariaLabel="النموذج الجديد مقابل الواقع"
                    labels={HOURS.map(String)}
                    series={[
                      { name: `الواقع (${WEEKDAYS[checkDay[0].weekday]} ${dateAr(checkDay[0].date)})`, values: checkDay.map((r) => r.orders), color: '#111833' },
                      { name: 'النموذج الجديد', values: checkDay.map((r) => round1(R.after.predict(r))), color: ml.color, dashed: true },
                    ]}
                  />
                </div>
                <p className="text-xs text-ink-500 mt-2">أرقام محسوبة فعليًا في متصفحك على بيانات تعليمية. اليوم المعروض من أيام الاختبار (5–7).</p>
              </div>
            )}
          </TeamCard>
        )}

        {/* 5. victory */}
        {step >= 4 && (
          <div className="relative animate-rise">
            <Confetti />
            <Card className="p-5 sm:p-6 border-2 border-emerald-400">
              <h2 className="text-2xl font-bold">🌙 النظام رجع يتوقع صح!</h2>
              <p className="text-ink-600 mt-1 mb-4">حرّك الساعة وشوف ليلة رمضانية في المطعم — النظام جهّز العدد المناسب من الموظفين.</p>
              <label htmlFor="rh" className="text-sm font-bold flex justify-between mb-1">
                <span>الساعة</span>
                <span dir="ltr">{fmtHour(hour)}</span>
              </label>
              <input id="rh" type="range" min={12} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="w-full mb-4" dir="ltr" />
              <LiveRestaurant hour={hour} orders={predAfter} staff={staffFor(predAfter)} ramadan caption="رمضان · عدد الموظفين حسب توقع النموذج الجديد" />
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <Feedback kind="success" title="وش تعلمنا؟">
                  النموذج مو «تسويه مرة وتنساه». العالم يتغير (رمضان، الصيف، افتتاح فرع جديد)، والفريق كله يرجع يشتغل: بيانات جديدة ← نمط جديد ← تدريب جديد.
                </Feedback>
                <Feedback kind="info" title="ودور الحوكمة؟">
                  نضيف تنبيهًا تلقائيًا: إذا ارتفع خطأ النموذج فوق حد معيّن، يوصل إشعار للفريق قبل ما تتصل أم فهد 😄
                </Feedback>
              </div>
              <div className="flex justify-end mt-5">
                <Button size="lg" onClick={() => finish(false)} iconEnd="arrow">
                  اكتشف مسارك
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamCard({ id, title, children }: { id: 'de' | 'da' | 'ml'; title: string; children: React.ReactNode }) {
  const meta = STATIONS.find((s) => s.id === id)!;
  return (
    <div className="animate-rise" style={{ '--accent': meta.color, '--accent-soft': meta.soft } as CSSProperties}>
      <Card className="p-5 sm:p-6 border-s-4" style={{ borderInlineStartColor: meta.color }}>
        <div className="flex items-center gap-3 mb-3">
          <Avatar c={CHARACTERS[id]} size={48} bg={meta.soft} />
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        {children}
      </Card>
    </div>
  );
}

export function Confetti() {
  const colors = STATIONS.map((s) => s.color);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible z-10" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, background: colors[i % 6], animationDelay: `${(i % 9) * 0.12}s` }} />
      ))}
    </div>
  );
}
