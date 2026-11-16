import { useState } from 'react';
import { CHARACTERS, OWNER, STATIONS } from '../data/stations';
import { Avatar } from '../components/Avatar';
import { Confetti } from './Ramadan';
import { STATION_ORDER, useStore } from '../state/store';
import { Icon } from '../components/Icon';
import { Button, Card, Modal } from '../components/ui';
import { Logo } from '../components/Shell';
import { computeScores, signalsFrom } from './CareerDiscovery';
import { useProject } from '../data/project';
import { earnedAchievements, Achievements } from '../components/Achievements';

export function Completion() {
  const { state, dispatch, go } = useStore();
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const done = STATION_ORDER.filter((s) => state.completed[s]).length;
  const project = useProject();
  const { ranked, fit } = computeScores(state.career.ratings, state.career.picks, signalsFrom(earnedAchievements(state, project), state.explored ?? [], !!state.boss.done));
  const top3 = ranked.slice(0, 3).map((id) => STATIONS.find((s) => s.id === id)!);
  const topTrack = STATIONS.find((s) => s.id === ranked[0])!;
  const minutes = state.startedAt && state.finishedAt ? Math.max(1, Math.round((state.finishedAt - state.startedAt) / 60000)) : null;
  const name = state.name.trim();

  const summary = `أكملت رحلة Decode the Data – اكتشف البيانات واكتشف مسارك 🎉
بنيت نظامًا يتوقع ازدحام مطعم DataBite في جدة عبر 6 مسارات: هندسة البيانات، تحليل البيانات، علم البيانات، هندسة تعلم الآلة، ذكاء الأعمال، وحوكمة البيانات.
أقرب المسارات لاهتماماتي: ${top3.map((t) => t.ar).join('، ')}
نتيجة نظامي ليلة العيد: ${project.outcome.upset} عميل زعلان، وخطأ النموذج ±${project.run.ev.realMae.toFixed(1)}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 pb-24">
      <div className="text-center animate-rise relative">
        <Confetti />
        <div className="flex justify-center items-end gap-1 sm:gap-2 mb-4 flex-wrap" aria-label="الفريق يصفق لك">
          {STATIONS.map((s, i) => (
            <div key={s.id} className="hop" style={{ animationDelay: `${i * 0.11}s` }}>
              <Avatar c={CHARACTERS[s.id]} size={56} bg={s.soft} mood="clap" />
            </div>
          ))}
          <div className="hop" style={{ animationDelay: '.7s' }}>
            <Avatar c={OWNER} size={64} bg="#FDEDF3" mood="clap" />
          </div>
        </div>
        <div className="text-2xl mb-2" aria-hidden="true">
          👏 👏 👏
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold">أكملت الرحلة!</h1>
        <p className="text-lg text-ink-600 mt-3 max-w-xl mx-auto">جرّبت عمل ستة تخصصات، وبنيت معهم نظامًا ذكيًا كاملًا — من بيانات فوضوية إلى قرار حقيقي.</p>
      </div>

      <div className="mt-10 rounded-3xl bg-ink-950 text-white p-6 sm:p-8 relative overflow-hidden shadow-lift" aria-label="بطاقة الإنجاز">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#ffffff14 1px, transparent 1px), linear-gradient(90deg, #ffffff14 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative">
          <div className="flex justify-between items-start gap-3">
            <Logo light />
            <span className="text-xs text-white/50">بطاقة إنجاز</span>
          </div>
          <div className="mt-8 text-white/60 text-sm">أُنجزت بواسطة</div>
          <div className="text-3xl font-bold mt-1 min-h-[2.5rem]">{name || 'مستكشف/ة البيانات'}</div>
          <div className="mt-6 flex gap-1.5">
            {STATIONS.map((s) => (
              <div key={s.id} className="flex-1 h-2 rounded-full" style={{ background: state.completed[s.id] ? s.color : '#ffffff22' }} title={s.ar} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div>
              <div className="text-2xl font-bold tabular-nums">{done}/6</div>
              <div className="text-xs text-white/60">محطات مكتملة{state.boss.done ? ' + تحدي رمضان 🌙' : ''}</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{minutes ? `${minutes} د` : '—'}</div>
              <div className="text-xs text-white/60">مدة الرحلة</div>
            </div>
            <div>
              <div className="text-lg font-bold leading-tight" style={{ color: topTrack.color }}>
                {topTrack.ar}
              </div>
              <div className="text-xs text-white/60">المسار الأقرب لك</div>
            </div>
          </div>
        </div>
      </div>

      <Card className="p-5 mt-5">
        <label htmlFor="name" className="font-bold block mb-2">
          اكتب اسمك على البطاقة (اختياري — يبقى على جهازك فقط)
        </label>
        <div className="flex gap-2 flex-wrap">
          <input
            id="name"
            value={state.name}
            maxLength={40}
            onChange={(e) => dispatch({ type: 'set', patch: { name: e.target.value } })}
            placeholder="اسمك"
            className="flex-1 min-w-[200px] rounded-xl border-2 border-ink-200 px-4 py-2.5 focus:border-ink-900 focus:outline-none"
          />
          <Button
            variant="secondary"
            icon={copied ? 'check' : 'spark'}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(summary);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'تم النسخ' : 'انسخ ملخص إنجازك'}
          </Button>
        </div>
        <p className="text-xs text-ink-500 mt-2">تقدر تلصق الملخص في لينكدإن أو تويتر وتشارك رحلتك.</p>
      </Card>

      <div className="grid sm:grid-cols-3 gap-3 mt-5">
        <Button variant="secondary" size="lg" icon="map" onClick={() => go('map')}>
          راجع المحطات
        </Button>
        <Button variant="secondary" size="lg" icon="board" onClick={() => go('system')}>
          النظام المكتمل
        </Button>
        <Button variant="secondary" size="lg" icon="restart" onClick={() => setConfirm(true)}>
          ابدأ من جديد
        </Button>
      </div>

      <Card className="p-5 sm:p-6 mt-5">
        <h2 className="font-bold text-xl mb-3">ملخص رحلتك الشخصي</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {top3.map((t, i) => (
            <div key={t.id} className="rounded-xl border border-ink-200 p-3">
              <div className="text-xs text-ink-500">{i === 0 ? 'الأقرب لك' : `خيار ${i + 1}`}</div>
              <div className="font-bold" style={{ color: t.color }}>
                {t.ar}
              </div>
              <div className="text-sm tabular-nums">توافق {fit(t.id)}%</div>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-3 text-center">
          <div className="rounded-xl bg-ink-50 p-3">
            <div className="text-xs text-ink-500">بيانات نظفتها</div>
            <div className="font-bold tabular-nums">{project.clean.rows.length} سجل</div>
          </div>
          <div className="rounded-xl bg-ink-50 p-3">
            <div className="text-xs text-ink-500">خطأ نموذجك الحقيقي</div>
            <div className="font-bold tabular-nums">±{project.run.ev.realMae.toFixed(1)}</div>
          </div>
          <div className="rounded-xl bg-ink-50 p-3">
            <div className="text-xs text-ink-500">ليلة العيد</div>
            <div className="font-bold tabular-nums">{project.outcome.upset} عميل زعلان</div>
          </div>
        </div>
        <div className="mt-4">
          <Achievements compact />
        </div>
      </Card>

      <Card className="p-5 sm:p-6 mt-8">
        <h2 className="font-bold text-xl mb-3">وش بعدها؟</h2>
        <ul className="space-y-2 text-[15px] text-ink-700">
          <li className="flex gap-2">
            <Icon name="check" size={18} className="text-emerald-600 shrink-0 mt-0.5" /> افتح خارطة الطريق للمسار اللي شدّك في صفحة «اكتشف مسارك» — فيها مصادر مجانية وبرامج سعودية وأول مشروع.
          </li>
          <li className="flex gap-2">
            <Icon name="check" size={18} className="text-emerald-600 shrink-0 mt-0.5" /> ابدأ بأساسيات مشتركة لكل المسارات: Excel، SQL، ومقدمة في Python والإحصاء.
          </li>
          <li className="flex gap-2">
            <Icon name="check" size={18} className="text-emerald-600 shrink-0 mt-0.5" /> جرّب مشروعًا صغيرًا على بيانات تهمك أنت — مثل مصاريفك أو نادٍ رياضي تتابعه.
          </li>
        </ul>
      </Card>

      <Modal open={confirm} title="تبدأ الرحلة من جديد؟" onClose={() => setConfirm(false)}>
        <p className="text-ink-600 mb-5">سيتم مسح تقدمك واختياراتك المحفوظة على هذا الجهاز.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            إلغاء
          </Button>
          <Button
            onClick={() => {
              dispatch({ type: 'reset' });
              go('landing');
            }}
          >
            نعم، ابدأ من جديد
          </Button>
        </div>
      </Modal>
    </div>
  );
}
