import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

export interface Term {
  id: string;
  en: string;
  ar: string;
  aliases?: string[];
  def: string;
  example: string;
  why?: string;
  /** station ids of specializations that use it most */
  track?: ('de' | 'da' | 'ds' | 'ml' | 'bi' | 'gov')[];
}

/** Plain-Arabic glossary — every English term in the journey links here. */
export const GLOSSARY: Term[] = [
  { id: 'cleaning', en: 'Data Cleaning', ar: 'تنظيف البيانات', def: 'إصلاح مشاكل البيانات قبل استخدامها: التكرار، النواقص، الصيغ المختلفة، والأرقام غير المنطقية.', example: 'حذف 9 صفوف مكررة وتعويض 12 خانة مفقودة في محطة 1.', why: 'كل تحليل ونموذج يرث أخطاء البيانات. «مدخلات سيئة = نتائج سيئة».', track: ['de', 'da', 'gov'] },
  { id: 'fe', en: 'Feature Engineering', ar: 'هندسة الخصائص', def: 'تحويل البيانات الخام إلى معلومات يفهمها النموذج.', example: 'من التاريخ صنعنا «هل اليوم ليلة عيد؟» و«هل هو يوم 27؟».', why: 'خاصية ذكية واحدة قد تحسّن النموذج أكثر من أي خوارزمية معقدة.', track: ['ds', 'ml'] },
  { id: 'overfit', en: 'Overfitting', ar: 'الإفراط في التعلّم', aliases: ['Memorize'], def: 'نموذج يحفظ تفاصيل وضجيج بيانات التدريب بدل النمط العام — ممتاز على القديم وسيئ على الجديد.', example: 'خيار «النموذج الحافظ» في محطة 4: خطأ ±0 على بياناته، و±3.9 على أسبوع جديد.', why: 'لأنه يعطي ثقة كاذبة. لذلك نختبر دائمًا على بيانات جديدة.', track: ['ml', 'ds'] },
  { id: 'prediction', en: 'Prediction', ar: 'التنبؤ', aliases: ['Predict'], def: 'تقدير قيمة مستقبلية بناءً على أنماط تعلّمها النموذج.', example: '«ليلة العيد الساعة 9: حوالي 84 طلب».', why: 'التنبؤ تقدير له هامش خطأ، وليس حقيقة مؤكدة.', track: ['ml', 'ds', 'bi'] },
  { id: 'governance', en: 'Data Governance', ar: 'حوكمة البيانات', def: 'القواعد والأدوار اللي تضمن أن البيانات موثوقة ومحمية ومستخدمة بشكل نظامي.', example: 'مراجعة قرارات المحطات، تقنيع الجوالات، ورفض بيعها.', why: 'بدونها تفقد المنشأة ثقة العملاء وتعرّض نفسها لمخالفات.', track: ['gov'] },
  { id: 'dataset', en: 'Dataset', ar: 'مجموعة بيانات', def: 'جدول (أو عدة جداول) فيه معلومات مرتبة عن موضوع واحد.', example: 'جدول طلبات DataBite لأربعة أسابيع: 336 صفًا، كل صف ساعة.', why: 'كل شي يبدأ منها — جودتها تحدد جودة النظام.', track: ['de'] },
  { id: 'pos', en: 'POS', ar: 'نظام نقاط البيع', aliases: ['Point of Sale'], def: 'جهاز الكاشير ونظامه — يسجّل كل طلب داخل المطعم.', example: 'ملف pos_export.csv جاء من كاشير صالة DataBite.' },
  { id: 'delivery', en: 'Delivery App', ar: 'تطبيق التوصيل', def: 'تطبيق خارجي يستقبل طلبات التوصيل ويرسل بياناتها بصيغته الخاصة.', example: 'كتب الوقت "9:00 PM" بدل "21:00" — فاحتجنا نوحّد الصيغ.' },
  { id: 'pipeline', en: 'Data Pipeline', ar: 'أنبوب البيانات', aliases: ['Pipeline'], def: 'سلسلة خطوات آلية تنقل البيانات من مصادرها وتنظفها وتجهزها، وتشتغل كل يوم بدون تدخل.', example: 'حذف التكرار ← معالجة المفقود ← توحيد الصيغ ← الدمج: طبقناها مرة، والأنبوب يكررها كل يوم.', why: 'يخلي التنظيف يتكرر آليًا كل يوم بدل ما يسويه أحد بيده.', track: ['de'] },
  { id: 'etl', en: 'ETL', ar: 'استخراج، تحويل، تحميل', aliases: ['ETL / ELT Pipelines', 'ELT'], def: 'Extract-Transform-Load: نسحب البيانات، نعدّلها للشكل المطلوب، ثم نحفظها في مكانها النهائي.', example: 'نسحب من الكاشير وتطبيق التوصيل، ننظف، ونحفظ في جدول واحد.', why: 'هو العمود الفقري لأي منصة بيانات.', track: ['de'] },
  { id: 'missing', en: 'Missing Value', ar: 'قيمة مفقودة', aliases: ['NULL', 'empty'], def: 'خانة يفترض فيها رقم لكنها فاضية — بسبب عطل أو خطأ إدخال.', example: 'طلبات الصالة الساعة 21:00 وصلت فاضية.', why: 'طريقة التعامل معها تغيّر نتائج التحليل والنموذج.', track: ['de'] },
  { id: 'imputation', en: 'Imputation', ar: 'تعويض القيم المفقودة', def: 'تقدير منطقي للقيمة المفقودة بدل حذفها، مع توثيق أنها مُقدّرة.', example: 'عوّضناها بمتوسط نفس الساعة في أيام الخميس العادية السابقة.', why: 'يحافظ على البيانات بدل حذفها، بشرط التوثيق.', track: ['de'] },
  { id: 'lineage', en: 'Data Lineage', ar: 'تتبّع أصل البيانات', def: 'توثيق من وين جاء كل رقم ووش صار له في الطريق.', example: 'نعرف أن قيمة 21:00 مُقدّرة وليست مسجّلة من الكاشير.', why: 'نعرف من وين جاء الرقم لو أحد شكك فيه.', track: ['gov'] },
  { id: 'insight', en: 'Insight', ar: 'رؤية / استنتاج', aliases: ['Insights'], def: 'معلومة مفيدة تطلع من البيانات وتساعد في قرار.', example: 'ليلة العيد أعلى بـ50% من خميس عادي.', why: 'البيانات بدون استنتاج مجرد أرقام.', track: ['da'] },
  { id: 'heatmap', en: 'Heatmap', ar: 'خريطة حرارية', def: 'جدول ملوّن: كل خانة لونها أغمق كل ما كان الرقم أكبر.', example: 'خانة الخميس 9 مساءً كانت الأغمق.', why: 'تكشف أنماط يوم×ساعة بنظرة واحدة.', track: ['da'] },
  { id: 'target', en: 'Target', ar: 'الهدف', def: 'الرقم اللي نبي النموذج يتوقعه.', example: 'عدد الطلبات في الساعة.', why: 'تحديد الهدف بدقة أول خطوة في أي مشروع تنبؤ.', track: ['ds'] },
  { id: 'granularity', en: 'Granularity', ar: 'دقة التفصيل', def: 'الوحدة اللي نقيس بها: كل ساعة؟ كل يوم؟ كل شهر؟', example: 'نتوقع لكل ساعة، لأن الورديات تتغير خلال اليوم.' },
  { id: 'horizon', en: 'Horizon', ar: 'مدى التوقع', def: 'كم قبل الحدث نحتاج التوقع.', example: 'قبل أسبوع — عشان نلحق نرتب الورديات.' },
  { id: 'feature', en: 'Features', ar: 'الخصائص', aliases: ['Feature', 'Feature Selection'], def: 'المعلومات اللي يعطيها النموذج عشان يتوقع.', example: 'الساعة، اليوم، ليلة العيد، يوم الراتب، العروض.', why: 'النموذج لا يعرف إلا ما تعطيه.', track: ['ds'] },
  { id: 'correlation', en: 'Correlation', ar: 'ارتباط', def: 'رقمين يتحركون مع بعض. ما يعني أن واحد يسبب الثاني.', example: 'عدد الموظفين يرتفع مع الطلبات — لأن المدير يجهّزهم للزحمة، مو العكس.', why: 'أكثر خطأ شائع: اعتبار الارتباط سببًا.', track: ['ds'] },
  { id: 'causation', en: 'Causation', ar: 'سببية', def: 'أن تغيير شيء يغيّر شيئًا آخر فعلًا.', example: 'ليلة العيد تسبب زحمة. زيادة الموظفين ما تجيب زبائن.', why: 'القرارات الصحيحة تُبنى على أسباب، لا على صدف.', track: ['ds'] },
  { id: 'leakage', en: 'Data Leakage', ar: 'تسرّب البيانات', def: 'استخدام معلومة في التدريب ما راح تكون متوفرة وقت التوقع الحقيقي — النتيجة تطلع ممتازة بشكل كاذب.', example: 'عدد الموظفين ما نعرفه قبل أسبوع، فما نستخدمه.', why: 'يعطي دقة وهمية تنهار عند الاستخدام.', track: ['ml'] },
  { id: 'regression', en: 'Regression', ar: 'انحدار', def: 'نوع نماذج يتوقع رقمًا، يتعلم من الأمثلة السابقة وزن كل عامل.', example: 'يتعلم أن ليلة العيد ترفع الطلبات وكم ترفعها.', why: 'أبسط نموذج قوي ومفهوم — نقطة بداية ممتازة.', track: ['ml'] },
  { id: 'model', en: 'Model', ar: 'نموذج', def: 'برنامج تعلّم نمطًا من البيانات ويستخدمه للتوقع.', example: 'نموذج DataBite يعطيك عدد الطلبات المتوقع لأي ساعة.', why: 'هو «العقل» اللي يحوّل البيانات لتوقعات.', track: ['ml'] },
  { id: 'training', en: 'Training', ar: 'التدريب', aliases: ['Train Model', 'fit'], def: 'المرحلة اللي يتعلم فيها النموذج من بيانات معروفة الإجابة.', example: 'درّبناه على الأسابيع 1–3.', why: 'جودة التدريب = جودة البيانات + الخصائص.', track: ['ml'] },
  { id: 'testset', en: 'Test Set', ar: 'بيانات الاختبار', aliases: ['Test'], def: 'بيانات نخبيها عن النموذج ونختبره عليها بعدين — عشان نعرف أداءه الحقيقي.', example: 'الأسبوع الرابع.', why: 'بدونه ما تعرف إذا النموذج يفهم أو يحفظ.', track: ['ml'] },
  { id: 'mae', en: 'MAE', ar: 'متوسط الخطأ المطلق', aliases: ['Mean Absolute Error'], def: 'كم يبعد التوقع عن الواقع في المتوسط.', example: '±2 يعني لو توقع 40، الواقع غالبًا بين 38 و42.', why: 'رقم واحد مفهوم يقول لك كم تثق بالتوقع.', track: ['ml'] },
  { id: 'mape', en: 'MAPE', ar: 'متوسط نسبة الخطأ', def: 'مثل MAE لكن كنسبة مئوية من الرقم الحقيقي.', example: '8% خطأ في المتوسط.' },
  { id: 'api', en: 'API', ar: 'واجهة برمجية', aliases: ['APIs'], def: 'باب يسمح لتطبيق يطلب خدمة من نظام ثاني.', example: 'تطبيق DataBite يسأل النموذج: «كم الزحمة الخميس 9؟» عن طريق API.', why: 'يحوّل النموذج من ملف إلى خدمة يستخدمها الناس.', track: ['ml'] },
  { id: 'deployment', en: 'Deployment', ar: 'النشر', def: 'نقل النموذج من جهاز المهندس إلى مكان يستخدمه الناس فعليًا.', example: 'زر «انشر الخاصية» في المحطة الرابعة.' },
  { id: 'mlops', en: 'MLOps', ar: 'تشغيل نماذج تعلم الآلة', def: 'ممارسات لمراقبة النماذج وتحديثها بعد الإطلاق.', example: 'لما دخل رمضان، اكتشفنا أن النموذج يخطئ وأعدنا تدريبه.' },
  { id: 'drift', en: 'Data Drift', ar: 'انحراف البيانات', def: 'لما يتغير سلوك الواقع عن البيانات اللي تدرب عليها النموذج — فيصير يخطئ.', example: 'في رمضان صارت الذروة عند الفطور والسحور بدل 9 مساءً.', why: 'النماذج تشيخ — لازم مراقبة وإعادة تدريب.', track: ['ml'] },
  { id: 'kpi', en: 'KPIs', ar: 'مؤشرات الأداء الرئيسية', aliases: ['KPI'], def: 'أرقام قليلة ومهمة تراقبها الإدارة لأنها مرتبطة بقرار.', example: 'الموظفون المطلوبون للذروة.', why: 'يركّز الإدارة على ما يهم.', track: ['bi'] },
  { id: 'dashboard', en: 'Dashboard', ar: 'لوحة معلومات', def: 'شاشة وحدة تجمع أهم الأرقام والرسوم لاتخاذ قرار بسرعة.', example: 'لوحة أم فهد الصباحية.', why: 'تختصر ساعات تحليل في نظرة.', track: ['bi'] },
  { id: 'pii', en: 'PII', ar: 'بيانات شخصية', aliases: ['Personal Data'], def: 'أي معلومة تكشف هوية شخص: اسم، جوال، عنوان…', example: 'أعمدة الاسم والجوال والعنوان في بيانات التوصيل.', why: 'حمايتها التزام قانوني وأخلاقي.', track: ['gov'] },
  { id: 'masked', en: 'Masked', ar: 'مقنّعة', aliases: ['Masking'], def: 'إخفاء جزء من البيانات الحساسة عن من لا يحتاجها.', example: '05•• ••• 871 بدل الرقم كامل.', why: 'يسمح بالعمل على البيانات بدون كشف الهوية.', track: ['gov'] },
  { id: 'leastpriv', en: 'Least Privilege', ar: 'أقل صلاحية لازمة', def: 'كل شخص يوصل فقط للبيانات اللي يحتاجها لعمله.', example: 'المحلل يشوف الطلبات المجمّعة، ما يشوف جوالات العملاء.', why: 'يقلل أثر أي تسرّب أو خطأ.', track: ['gov'] },
  { id: 'pdpl', en: 'PDPL', ar: 'نظام حماية البيانات الشخصية', def: 'النظام السعودي اللي ينظم جمع البيانات الشخصية واستخدامها ومشاركتها، وتشرف عليه سدايا.', example: 'ما نرسل رسائل تسويقية إلا لعميل وافق صراحة.', why: 'يحدد ما يجوز وما لا يجوز بالبيانات الشخصية في السعودية.', track: ['gov'] },
  { id: 'catalog', en: 'Data Catalog', ar: 'كتالوج البيانات', def: 'فهرس يوضح وش البيانات الموجودة، ومين مسؤول عنها، ووش معناها.', example: 'يوضح أن عمود "orders" = طلبات الصالة + التوصيل.' },
  { id: 'metadata', en: 'Metadata', ar: 'بيانات وصفية', def: 'بيانات عن البيانات: مصدرها، تاريخها، معناها.', example: 'هذا الجدول تم تحديثه أمس الساعة 2 الفجر من الكاشير.' },
];

const TRACK_AR = { de: 'مهندس البيانات', da: 'محلل البيانات', ds: 'عالم البيانات', ml: 'مهندس تعلم الآلة', bi: 'مختص ذكاء الأعمال', gov: 'مختص الحوكمة' } as const;
const norm = (s: string) => s.trim().toLowerCase().replace(/[()]/g, '');
const INDEX = new Map<string, Term>();
GLOSSARY.forEach((t) => [t.en, ...(t.aliases ?? [])].forEach((k) => INDEX.set(norm(k), t)));
export const findTerm = (text: string) => INDEX.get(norm(text)) ?? null;

// tiny global store so any <En> can open the glossary
let openId: string | null | undefined = undefined; // undefined = closed, null = list
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const openGlossary = (id: string | null = null) => {
  openId = id;
  emit();
};
const closeGlossary = () => {
  openId = undefined;
  emit();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function GlossaryHost() {
  const current = useSyncExternalStore(subscribe, () => openId);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (current === undefined) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeGlossary();
    window.addEventListener('keydown', k);
    ref.current?.querySelector<HTMLElement>('button, input')?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [current]);
  const list = useMemo(() => {
    const n = norm(q);
    return GLOSSARY.filter((t) => !n || norm(t.en).includes(n) || t.ar.includes(q.trim()) || t.def.includes(q.trim()));
  }, [q]);
  const term = current ? GLOSSARY.find((t) => t.id === current) : null;
  return (
    <>
      <button
        onClick={() => openGlossary(null)}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full bg-white/95 border border-ink-200 shadow-lift px-3 py-2.5 sm:px-3.5 sm:py-2 text-sm font-semibold text-ink-800 hover:border-ink-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200 print:hidden"
        aria-label="قاموس المصطلحات"
      >
        <span aria-hidden="true">📖</span>
        <span className="hidden sm:inline">القاموس</span>
      </button>
      {current !== undefined && (
        <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-ink-950/50 backdrop-blur-sm p-0 sm:p-4" onClick={closeGlossary}>
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="قاموس المصطلحات"
            className="bg-white w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-lift p-5 animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold">{term ? 'شرح المصطلح' : 'قاموس المصطلحات'}</h2>
              <button onClick={closeGlossary} className="rounded-lg px-2 py-1 text-ink-500 hover:bg-ink-100" aria-label="إغلاق">
                ✕
              </button>
            </div>
            {term ? (
              <TermCard t={term} onAll={() => openGlossary(null)} />
            ) : (
              <>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ابحث: Pipeline، تسرّب، KPI…"
                  className="w-full rounded-xl border-2 border-ink-200 px-3 py-2 mb-3 focus:border-ink-900 focus:outline-none"
                />
                <ul className="space-y-1.5">
                  {list.map((t) => (
                    <li key={t.id}>
                      <button onClick={() => openGlossary(t.id)} className="w-full text-right rounded-xl border border-ink-200 px-3 py-2 hover:border-ink-400 flex items-center justify-between gap-2">
                        <span className="font-semibold">{t.ar}</span>
                        <bdi dir="ltr" className="font-mono text-xs text-ink-500">
                          {t.en}
                        </bdi>
                      </button>
                    </li>
                  ))}
                  {!list.length && <li className="text-ink-500 text-sm">ما لقينا هالكلمة — جرّب كلمة ثانية.</li>}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function TermCard({ t, onAll }: { t: Term; onAll: () => void }) {
  return (
    <div>
      <bdi dir="ltr" className="font-mono text-sm rounded-md bg-ink-100 px-2 py-0.5 text-ink-700">
        {t.en}
      </bdi>
      <div className="text-2xl font-bold mt-2">{t.ar}</div>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-800">{t.def}</p>
      <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[15px] text-amber-950">
        <span className="font-bold">🍽️ من مطعمنا: </span>
        {t.example}
      </div>
      {t.why && (
        <p className="mt-3 text-[15px] text-ink-800">
          <span className="font-bold">ليش يهم؟ </span>
          {t.why}
        </p>
      )}
      {t.track && (
        <p className="mt-2 text-sm text-ink-600">
          <span className="font-bold">مين يستخدمه أكثر؟ </span>
          {t.track.map((k) => TRACK_AR[k]).join('، ')}
        </p>
      )}
      <button onClick={onAll} className="mt-4 text-sm font-semibold text-ink-600 hover:text-ink-900 underline underline-offset-4">
        كل المصطلحات
      </button>
    </div>
  );
}
