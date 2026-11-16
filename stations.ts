import type { StationId } from '../state/store';

export interface StationMeta {
  id: StationId;
  num: number;
  ar: string;
  en: string;
  role: string;
  presenter: string;
  color: string; // main accent
  soft: string; // tinted background
  icon: IconName;
  verb: string; // one-line contribution to the project
  objective: string;
  output: string;
  profession: string;
  dayToDay: string[];
  tools: string[];
  beginnerTopics: string[];
  govNote: string; // governance applies to the whole lifecycle
}

export type IconName =
  | 'pipe' | 'chart' | 'flask' | 'cpu' | 'board' | 'shield' | 'check' | 'x' | 'arrow' | 'arrowBack' | 'lock'
  | 'bulb' | 'play' | 'restart' | 'map' | 'user' | 'spark' | 'clock' | 'table' | 'store' | 'present' | 'eye' | 'phone' | 'trophy' | 'hand';

export const STATIONS: StationMeta[] = [
  {
    id: 'de', role: 'مهندس البيانات', num: 1, ar: 'هندسة البيانات', en: 'Data Engineering', presenter: 'عبدالاله ناصر',
    color: '#0891B2', soft: '#E6F6FA', icon: 'pipe',
    verb: 'يجمع البيانات من مصادرها، ينظفها ويجهزها',
    objective: 'حوّل بيانات خام فوضوية من مصدرين إلى جدول واحد نظيف يعتمد عليه الفريق كله.',
    output: 'مجموعة بيانات نظيفة وموحّدة للمطعم',
    profession: 'مهندس البيانات يبني "الأنابيب" التي تنقل البيانات من مصادرها (أنظمة البيع، التطبيقات، الحساسات) إلى مكان واحد موثوق. بدون عمله، كل من يأتي بعده يبني على بيانات ناقصة أو مكررة.',
    dayToDay: ['بناء مسارات نقل البيانات (ETL / ELT Pipelines)', 'تنظيف البيانات وتوحيد صيغها', 'تصميم قواعد البيانات ومستودعات البيانات', 'مراقبة جودة البيانات وتشغيلها تلقائيًا'],
    tools: ['SQL', 'Python', 'Apache Airflow', 'Spark', 'Cloud Data Warehouses'],
    beginnerTopics: ['أساسيات SQL', 'Python ومكتبة pandas', 'مفهوم ETL', 'تصميم الجداول (Data Modeling)'],
    govNote: 'الحوكمة تبدأ من هنا: توثيق مصدر كل عمود (Data Lineage) وعدم نقل بيانات شخصية لا نحتاجها.',
  },
  {
    id: 'da', role: 'محلل البيانات', num: 2, ar: 'تحليل البيانات', en: 'Data Analysis', presenter: 'عبدالرحمن مغل',
    color: '#3B6EF5', soft: '#ECF1FF', icon: 'chart',
    verb: 'يحلل البيانات ويكتشف الأنماط وأوقات الذروة',
    objective: 'استكشف الرسوم البيانية واكتشف متى يزدحم مطعم DataBite فعلًا.',
    output: 'تقرير بأوقات الذروة وأنماط الطلب',
    profession: 'محلل البيانات يطرح أسئلة على البيانات ويحوّل الأرقام إلى إجابات واضحة: متى؟ أين؟ كم؟ ثم يعرضها بطريقة يفهمها صاحب القرار.',
    dayToDay: ['استكشاف البيانات وتلخيصها', 'بناء الرسوم البيانية', 'كتابة تقارير ورؤى (Insights)', 'الإجابة عن أسئلة الإدارة بالأرقام'],
    tools: ['Excel', 'SQL', 'Python', 'Power BI / Tableau'],
    beginnerTopics: ['الإحصاء الوصفي (متوسط، وسيط، توزيع)', 'Excel والجداول المحورية', 'SQL للاستعلام', 'قراءة الرسوم البيانية واختيارها'],
    govNote: 'المحلل يعمل على بيانات مجمّعة بدون هوية العملاء — يكفيه "كم طلب" لا "من طلب".',
  },
  {
    id: 'ds', role: 'عالم البيانات', num: 3, ar: 'علم البيانات', en: 'Data Science', presenter: 'عبدالمحسن بالبيد',
    color: '#8B5CF6', soft: '#F3EEFF', icon: 'flask',
    verb: 'يصيغ المشكلة ويختار العوامل وطريقة التنبؤ',
    objective: 'حدّد سؤال التنبؤ بدقة، واختر العوامل التي تساعد فعلًا على توقع الازدحام.',
    output: 'مشكلة تنبؤ محددة + خصائص مختارة + منهج أولي',
    profession: 'عالم البيانات يحقق في المشكلة: ما السؤال الصحيح؟ ما العوامل المؤثرة؟ هل العلاقة سببية أم مجرد ارتباط؟ ثم يجرّب مناهج مختلفة ليقترح أنسبها.',
    dayToDay: ['صياغة المشكلة بشكل قابل للقياس', 'التحليل الإحصائي واختبار الفرضيات', 'اختيار الخصائص (Feature Selection)', 'تجربة ومقارنة نماذج أولية'],
    tools: ['Python', 'Jupyter', 'pandas / scikit-learn', 'الإحصاء'],
    beginnerTopics: ['الاحتمالات والإحصاء', 'الارتباط مقابل السببية', 'Python للتحليل', 'مقدمة في تعلم الآلة'],
    govNote: 'لا نستخدم بيانات شخصية كخصائص للنموذج إن لم تكن ضرورية — ونتحقق ألا يحمل النموذج تحيّزًا.',
  },
  {
    id: 'ml', role: 'مهندس تعلم الآلة', num: 4, ar: 'هندسة تعلم الآلة', en: 'Machine Learning Engineering', presenter: 'طارق القحطاني',
    color: '#E8467C', soft: '#FDEDF3', icon: 'cpu',
    verb: 'يدرّب النموذج ويقيّمه ويحوّله إلى خاصية في التطبيق',
    objective: 'درّب نموذجًا حقيقيًا، قيّمه على بيانات لم يرها، ثم استخدمه للتنبؤ بالازدحام.',
    output: 'نموذج تنبؤ يعمل + خاصية جاهزة في التطبيق',
    profession: 'مهندس تعلم الآلة يأخذ المنهج الذي اقترحه عالم البيانات ويحوّله إلى نموذج يعمل بشكل موثوق: يدرّبه، يقيس أداءه بأمانة، ويربطه بالتطبيقات ويراقبه بعد الإطلاق.',
    dayToDay: ['كتابة كود التدريب والتقييم', 'تجهيز النموذج للإنتاج (Deployment)', 'بناء واجهات برمجية (APIs) للتنبؤ', 'مراقبة أداء النموذج وتحديثه (MLOps)'],
    tools: ['Python', 'scikit-learn / PyTorch', 'Docker', 'MLflow', 'Cloud'],
    beginnerTopics: ['البرمجة بـ Python', 'أساسيات تعلم الآلة', 'تقسيم البيانات للتدريب والاختبار', 'مقاييس التقييم'],
    govNote: 'نوثّق نسخة النموذج والبيانات التي تدرّب عليها، ونقيّم بأمانة — بدون تضخيم الدقة.',
  },
  {
    id: 'bi', role: 'مختصة ذكاء الأعمال', num: 5, ar: 'ذكاء الأعمال', en: 'Business Intelligence', presenter: 'يُعلن لاحقًا',
    color: '#F59E0B', soft: '#FFF6E5', icon: 'board',
    verb: 'يحوّل الأرقام والتوقعات إلى لوحة قرارات للإدارة',
    objective: 'ابنِ لوحة معلومات تساعد مديرة المطعم على اتخاذ قرار التوظيف.',
    output: 'لوحة معلومات إدارية للمطعم',
    profession: 'مختص ذكاء الأعمال يربط البيانات بأهداف المنشأة: يحدد المؤشرات المهمة (KPIs)، يبني لوحات معلومات واضحة، ويساعد الإدارة على اتخاذ قرارات مبنية على البيانات.',
    dayToDay: ['تحديد مؤشرات الأداء مع الإدارة', 'تصميم لوحات المعلومات', 'نمذجة البيانات للتقارير', 'تحويل الأسئلة الإدارية إلى تقارير'],
    tools: ['Power BI', 'Tableau', 'SQL', 'Excel'],
    beginnerTopics: ['مؤشرات الأداء KPIs', 'مبادئ تصميم اللوحات', 'Power BI أو Tableau', 'سرد القصص بالبيانات'],
    govNote: 'لوحة المعلومات تظهر لكل مستخدم ما يحتاجه فقط، وتوضّح أن التوقعات تقديرية وليست ضمانات.',
  },
  {
    id: 'gov', role: 'مختصة حوكمة البيانات', num: 6, ar: 'حوكمة البيانات', en: 'Data Governance', presenter: 'شادن باناجه',
    color: '#16A34A', soft: '#E9F8EE', icon: 'shield',
    verb: 'يضمن جودة البيانات وخصوصيتها والصلاحيات الصحيحة',
    objective: 'راجع النظام كاملًا: احمِ البيانات الحساسة، وزّع الصلاحيات، وعالج مشكلة جودة.',
    output: 'نظام مُراجَع ومعتمد من ناحية الحوكمة',
    profession: 'مختص حوكمة البيانات يضع القواعد التي تجعل البيانات موثوقة وآمنة: من يملكها؟ من يحق له رؤيتها؟ كيف نضمن جودتها؟ وهل نلتزم بأنظمة حماية البيانات الشخصية؟',
    dayToDay: ['تصنيف البيانات حسب حساسيتها', 'إدارة الصلاحيات والوصول', 'وضع معايير وقواعد الجودة', 'الامتثال لأنظمة حماية البيانات الشخصية'],
    tools: ['كتالوج البيانات (Data Catalog)', 'أدوات جودة البيانات', 'سياسات الوصول', 'Excel / SQL'],
    beginnerTopics: ['مبادئ حماية البيانات الشخصية', 'جودة البيانات وأبعادها', 'إدارة الصلاحيات (Least Privilege)', 'إدارة البيانات الوصفية (Metadata)'],
    govNote: 'الحوكمة ليست محطة أخيرة فقط — لمساتها كانت حاضرة في كل محطة مررت بها.',
  },
];

export const stationById = (id: StationId) => STATIONS.find((s) => s.id === id)!;

/** The friendly team characters (original drawings — one per role, plus the owner). */
export interface Character {
  name: string;
  look: 'shemagh' | 'hijab' | 'cap' | 'hijabLight';
  skin: string;
  greeting: string;
}
export const OWNER: Character = { name: 'أم فهد', look: 'hijab', skin: '#C98F63', greeting: '' };
export const CHARACTERS: Record<StationId, Character> = {
  de: { name: 'مهندس البيانات', look: 'shemagh', skin: '#C68B5E', greeting: 'أهلًا بك. البيانات وصلتنا من مصدرين وفيها مشاكل. مهمتنا ننظفها قبل ما يبني عليها أحد.' },
  da: { name: 'محلل البيانات', look: 'cap', skin: '#B97A50', greeting: 'استلمنا الجدول اللي جهّزته. الحين نخلي الأرقام تتكلم: متى يزدحم المطعم؟ وأي الأيام مختلفة؟' },
  ds: { name: 'عالم البيانات', look: 'shemagh', skin: '#A86D45', greeting: 'المحلل قال لنا «متى». دوري أسأل «ليش؟» وأي العوامل نقدر نعرفها قبل بأسبوع عشان نتوقع.' },
  ml: { name: 'مهندس تعلم الآلة', look: 'cap', skin: '#C99169', greeting: 'استلمنا المنهج من عالم البيانات. الحين نبني نموذجًا حقيقيًا، نختبره بأمانة، ونشغّله في التطبيق.' },
  bi: { name: 'مختصة ذكاء الأعمال', look: 'hijabLight', skin: '#D3A07A', greeting: 'أم فهد تحتاج شاشة وحدة تفتحها كل صباح وتعرف منها قرارها. هذا اللي بنبنيه.' },
  gov: { name: 'مختصة حوكمة البيانات', look: 'hijab', skin: '#BF8660', greeting: 'قبل الإطلاق نراجع قرارات الفريق كلها: هل البيانات موثوقة ومحمية ونظامية؟ الحوكمة كانت معك من المحطة الأولى.' },
};

/** "What do I do tomorrow?" — a realistic starting roadmap per track. Links checked Nov 2026; programmes and dates change. */
export interface Roadmap {
  firstWeeks: string[];
  free: { name: string; url: string; note: string }[];
  saudi: { name: string; url: string; note: string }[];
  firstProject: string;
  time: string;
}
const KAGGLE = 'https://www.kaggle.com/learn';
const SATR = 'https://satr.codes';
const TUWAIQ = 'https://tuwaiq.edu.sa';
const SDAIA_ACADEMY = 'https://athkax.sdaia.gov.sa';
const MISK = 'https://hub.misk.org.sa';
export const ROADMAPS: Record<StationId, Roadmap> = {
  de: {
    firstWeeks: ['SQL: الاستعلام والربط بين الجداول (JOIN)', 'Python وأساسيات pandas لتنظيف الجداول', 'مفهوم ETL: استخراج ← تحويل ← تحميل'],
    free: [
      { name: 'Kaggle Learn: Intro to SQL + Pandas + Data Cleaning', url: KAGGLE, note: 'دورات قصيرة مجانية بالتطبيق المباشر' },
      { name: 'منصة سطر', url: SATR, note: 'تعلّم البرمجة بالعربي مجانًا' },
    ],
    saudi: [
      { name: 'أكاديمية طويق', url: TUWAIQ, note: 'معسكرات وبرامج في البيانات والبرمجة' },
      { name: 'أكاديمية سدايا (منصة أذكى إكس)', url: SDAIA_ACADEMY, note: 'برامج ومعسكرات للمبتدئين والمختصين' },
    ],
    firstProject: 'خذ ملفين CSV مختلفين لنفس الموضوع من Kaggle، نظّفهما وادمجهما في جدول واحد — بالضبط مثل المحطة الأولى.',
    time: 'تقريبًا 2–3 أشهر من التعلم المنتظم لتبني الأساس',
  },
  da: {
    firstWeeks: ['Excel: الجداول المحورية والرسوم', 'الإحصاء الوصفي: المتوسط والوسيط والتوزيع', 'SQL للاستعلام عن البيانات'],
    free: [
      { name: 'Kaggle Learn: Pandas + Data Visualization', url: KAGGLE, note: 'تحليل ورسوم بلغة Python' },
      { name: 'منصة سطر', url: SATR, note: 'أساسيات البرمجة بالعربي' },
    ],
    saudi: [
      { name: 'أكاديمية طويق', url: TUWAIQ, note: 'برامج تحليل البيانات وعلومها' },
      { name: 'مسك – برنامج علم البيانات وتعلم الآلة', url: MISK, note: 'برنامج تطبيقي باللغة العربية (تحقق من مواعيد التسجيل)' },
    ],
    firstProject: 'حلّل مصاريفك الشخصية لشهرين أو بيانات نادٍ تتابعه: متى تصرف أكثر؟ ارسم 3 رسوم واكتب 3 استنتاجات.',
    time: 'تقريبًا 2–3 أشهر لتبدأ بمشاريع صغيرة',
  },
  ds: {
    firstWeeks: ['الإحصاء والاحتمالات: الارتباط مقابل السببية', 'Python مع pandas', 'مقدمة في تعلم الآلة: الخصائص والهدف'],
    free: [
      { name: 'Kaggle Learn: Intro to Machine Learning + Feature Engineering', url: KAGGLE, note: 'تبني أول نموذج خلال ساعات' },
      { name: 'Google Machine Learning Crash Course', url: 'https://developers.google.com/machine-learning/crash-course', note: 'مقدمة مجانية من Google' },
    ],
    saudi: [
      { name: 'مسك – برنامج علم البيانات وتعلم الآلة', url: MISK, note: '8 أسابيع باللغة العربية مع مشروع تخرج' },
      { name: 'أكاديمية سدايا (منصة أذكى إكس)', url: SDAIA_ACADEMY, note: 'برامج في البيانات والذكاء الاصطناعي' },
    ],
    firstProject: 'شارك في مسابقة Titanic على Kaggle: صِغ السؤال، اختر الخصائص، واكتب ليش اخترتها.',
    time: 'تقريبًا 3–4 أشهر لأساس متين في الإحصاء وPython',
  },
  ml: {
    firstWeeks: ['البرمجة بـ Python بثقة', 'أساسيات تعلم الآلة وscikit-learn', 'تقسيم البيانات ومقاييس التقييم'],
    free: [
      { name: 'Kaggle Learn: Intro + Intermediate Machine Learning', url: KAGGLE, note: 'من أول نموذج إلى تقييمه بشكل صحيح' },
      { name: 'Google Machine Learning Crash Course', url: 'https://developers.google.com/machine-learning/crash-course', note: 'مفاهيم التدريب والتقييم' },
    ],
    saudi: [
      { name: 'أكاديمية طويق', url: TUWAIQ, note: 'معسكرات تعلم الآلة والذكاء الاصطناعي' },
      { name: 'أكاديمية سدايا (منصة أذكى إكس)', url: SDAIA_ACADEMY, note: 'برامج متقدمة بعد الأساسيات' },
    ],
    firstProject: 'درّب نموذجًا يتوقع أسعار البيوت (مسابقة House Prices على Kaggle)، وقيّمه على بيانات اختبار منفصلة.',
    time: 'تقريبًا 4–6 أشهر — يحتاج برمجة أكثر من باقي المسارات',
  },
  bi: {
    firstWeeks: ['Excel والجداول المحورية', 'مؤشرات الأداء: كيف تختار KPI مرتبط بقرار', 'Power BI أو Tableau: أول لوحة'],
    free: [
      { name: 'Microsoft Learn: Power BI', url: 'https://learn.microsoft.com/training/powerplatform/power-bi', note: 'مسارات تعلم مجانية من Microsoft' },
      { name: 'Tableau Public', url: 'https://public.tableau.com', note: 'نسخة مجانية لنشر لوحاتك' },
    ],
    saudi: [
      { name: 'أكاديمية طويق', url: TUWAIQ, note: 'برامج تحليل البيانات وأدواتها' },
      { name: 'أكاديمية سدايا (منصة أذكى إكس)', url: SDAIA_ACADEMY, note: 'برامج رفع الوعي بالبيانات' },
    ],
    firstProject: 'ابنِ لوحة من صفحة واحدة لبيانات حقيقية (مثلًا مبيعات من Kaggle) فيها 4 مؤشرات فقط وقرار واحد تساعد فيه.',
    time: 'تقريبًا 2–3 أشهر لتبني لوحات تعرضها في ملفك',
  },
  gov: {
    firstWeeks: ['نظام حماية البيانات الشخصية السعودي (PDPL) ومبادئه', 'أبعاد جودة البيانات: الدقة، الاكتمال، الاتساق', 'تصنيف البيانات وإدارة الصلاحيات'],
    free: [
      { name: 'موقع سدايا — نظام حماية البيانات الشخصية ولوائحه', url: 'https://sdaia.gov.sa', note: 'المصدر الرسمي للنظام والأدلة الإرشادية' },
      { name: 'Kaggle Learn: Intro to SQL', url: KAGGLE, note: 'تحتاج تفهم البيانات اللي تحوكمها' },
    ],
    saudi: [
      { name: 'أكاديمية سدايا (منصة أذكى إكس)', url: SDAIA_ACADEMY, note: 'برامج البيانات من الجهة المشرفة على الحوكمة' },
      { name: 'أكاديمية طويق', url: TUWAIQ, note: 'برامج تقنية مساندة' },
    ],
    firstProject: 'خذ أي جدول بيانات عام وصنّف أعمدته (شخصية / حساسة / عامة)، واكتب من يحق له رؤية كل عمود ولماذا.',
    time: 'تقريبًا 2–3 أشهر للأساسيات، ويكبر مع الخبرة العملية',
  },
};

/** The core concept of each station, at two levels: simple first, then "explore further". */
export const CONCEPTS: Record<StationId, { title: string; simple: string; deeper: string[]; pro: string }> = {
  de: {
    title: 'ليش التنظيف قبل كل شي؟',
    simple: 'مثل الطبخ: لو المكونات خربانة، ما يفيدك أمهر طباخ. البيانات الناقصة أو المكررة تخرّب كل شي يُبنى عليها.',
    deeper: [
      'جودة البيانات لها أبعاد: الاكتمال (ما فيها نواقص)، التفرّد (بدون تكرار)، الاتساق (نفس الصيغة)، والدقة (أرقام منطقية).',
      'تعويض القيم المفقودة (Imputation) له طرق: متوسط عام، متوسط مجموعة مشابهة، أو نماذج تقدير. الأهم أن نوثّق أن القيمة مُقدّرة.',
      'في الشركات تُكتب هذه الخطوات كأنبوب آلي (ETL/ELT) يشتغل كل يوم، مع اختبارات جودة تمنع البيانات السيئة من المرور.',
    ],
    pro: 'أدوات: SQL، Python/pandas، Apache Airflow، dbt.',
  },
  da: {
    title: 'نمط أم سبب؟',
    simple: 'المحلل يجاوب «متى؟ وكم؟». لو قال «ليش؟» لازم يكون عنده دليل، مو مجرد إحساس.',
    deeper: [
      'التحليل الوصفي (Descriptive) يلخّص ما حدث: متوسطات، توزيعات، مقارنات.',
      'المقارنة العادلة تقارن الشبيه بالشبيه: نفس اليوم ونفس الساعة، مع وبدون العامل.',
      'إثبات السبب يحتاج تجربة (A/B Test) أو تصميم إحصائي يتحكم في العوامل الأخرى.',
    ],
    pro: 'أدوات: Excel، SQL، Python، Power BI / Tableau.',
  },
  ds: {
    title: 'الخصائص: وش يشوف النموذج؟',
    simple: 'النموذج ما يعرف إلا اللي تعطيه. أعطه معلومات مفيدة نعرفها مسبقًا — ولا تعطيه معلومة من المستقبل.',
    deeper: [
      'هندسة الخصائص (Feature Engineering): تحويل البيانات الخام لمعلومات مفيدة، مثل «هل هذا اليوم ليلة عيد؟».',
      'الارتباط القوي قد يكون سببية معكوسة أو صدفة. عدد الموظفين مرتبط بالطلبات لأن المدير يجهّزهم للزحمة.',
      'تسرّب البيانات (Data Leakage): خاصية متاحة وقت التدريب وغير متاحة وقت التنبؤ — تعطي دقة وهمية.',
    ],
    pro: 'أدوات: Python، Jupyter، pandas، scikit-learn، الإحصاء.',
  },
  ml: {
    title: 'التدريب والاختبار',
    simple: 'النموذج يتعلم من أمثلة قديمة، ونختبره على أمثلة جديدة ما شافها — مثل طالب يذاكر ثم يختبر بأسئلة جديدة.',
    deeper: [
      'فصل بيانات الاختبار (Train/Test Split) هو الطريقة الوحيدة لمعرفة الأداء الحقيقي.',
      'الإفراط في التعلم (Overfitting): نموذج يحفظ التفاصيل والضجيج بدل النمط — ممتاز على القديم، سيئ على الجديد.',
      'بعد الإطلاق: نراقب النموذج (MLOps) لأن العالم يتغير (Data Drift) — مثل رمضان.',
    ],
    pro: 'أدوات: Python، scikit-learn / PyTorch، MLflow، Docker.',
  },
  bi: {
    title: 'لوحة تخدم قرارًا',
    simple: 'اللوحة الجيدة تجاوب سؤال المديرة في 5 ثواني: «كم موظف أحتاج الليلة؟». أي رقم ما يخدم قرارًا يشتت.',
    deeper: [
      'مؤشر الأداء (KPI) الجيد: مرتبط بهدف، قابل للقياس، ويتغير القرار بتغيّره.',
      'نوع الرسم يتبع نوع السؤال: مقارنة ← أعمدة، اتجاه زمني ← خط، جزء من كل ← دائري (لأجزاء قليلة).',
      'اللوحة تعرض التوقع مع هامش خطئه، حتى لا يُعامَل كرقم مؤكد.',
    ],
    pro: 'أدوات: Power BI، Tableau، SQL، Excel.',
  },
  gov: {
    title: 'الحوكمة طول الطريق',
    simple: 'الحوكمة تتأكد أن البيانات موثوقة، ومحمية، ومستخدمة بشكل نظامي — من أول صف لآخر قرار.',
    deeper: [
      'تصنيف البيانات: عامة، داخلية، شخصية، حساسة — ولكل تصنيف قواعد وصول.',
      'أقل صلاحية لازمة (Least Privilege) وتتبّع أصل البيانات (Data Lineage).',
      'الامتثال: نظام حماية البيانات الشخصية في السعودية تشرف عليه سدايا — مثل اشتراط الموافقة الصريحة للتسويق المباشر.',
    ],
    pro: 'أدوات: كتالوج البيانات، أدوات جودة البيانات، سياسات الوصول.',
  },
};
