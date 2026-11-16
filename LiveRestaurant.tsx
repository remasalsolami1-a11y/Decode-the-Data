import { useMemo } from 'react';
import { fmtHour } from '../data/dataset';
import { TABLES, simulate } from '../data/sim';
import { cx } from './ui';

export { simulate } from '../data/sim';

function sky(hour: number, ramadan?: boolean) {
  if (hour <= 16) return { top: '#7FC3EE', bottom: '#CDEBFA', sea: '#2F8DBA', night: false, sun: true };
  if (hour === 17) return { top: '#F6A15A', bottom: '#FBD38D', sea: '#3A7EA6', night: false, sun: true };
  if (hour === 18) return { top: ramadan ? '#3B2C5C' : '#E5677A', bottom: '#F4A26B', sea: '#2C5A84', night: false, sun: false };
  return { top: '#0A1433', bottom: '#1E2B5C', sea: '#0D2147', night: true, sun: false };
}

/** Top-down view of DataBite on Jeddah corniche. Pure SVG, driven by data. */
export function LiveRestaurant({
  hour,
  orders,
  staff,
  eid,
  ramadan,
  className,
  caption,
}: {
  hour: number;
  orders: number;
  staff: number;
  eid?: boolean;
  ramadan?: boolean;
  className?: string;
  caption?: string;
}) {
  const sim = simulate(orders, staff);
  const s = sky(hour, ramadan);
  const speed = Math.max(0.35, 1.1 - sim.load * 0.35);
  const guestColors = ['#E8467C', '#3B6EF5', '#F59E0B', '#0891B2', '#8B5CF6', '#16A34A'];
  const tables = useMemo(
    () => Array.from({ length: TABLES }, (_, i) => ({ x: 70 + (i % 7) * 58, y: i < 7 ? 160 : 252 })),
    [],
  );
  const cooks = Math.min(staff, 14);
  return (
    <figure className={cx('relative rounded-2xl overflow-hidden border border-ink-200 bg-ink-950', className)}>
      <svg viewBox="0 0 640 380" className="w-full h-auto block" style={{ direction: 'ltr' }} role="img" aria-label={`مطعم DataBite الساعة ${fmtHour(hour)}: ${Math.round(orders)} طلب، ${staff} موظفين، وقت الانتظار ${sim.wait} دقيقة`}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.top} />
            <stop offset="1" stopColor={s.bottom} />
          </linearGradient>
          <radialGradient id="glow">
            <stop offset="0" stopColor="#fff" stopOpacity=".9" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* sky + sea (Jeddah corniche) */}
        <rect width="640" height="96" fill="url(#sky)" style={{ transition: 'fill 1s' }} />
        {s.sun && <circle cx={80 + (hour - 12) * 70} cy={hour === 17 ? 52 : 28} r="13" fill="#FFE08A" />}
        {s.night && (
          <>
            {[30, 95, 160, 240, 310, 380, 430, 600].map((x, i) => (
              <circle key={x} cx={x} cy={10 + ((i * 17) % 34)} r="1.2" fill="#fff" opacity=".8" />
            ))}
            {ramadan ? (
              <path d="M590 22a11 11 0 1 0 8 18 9 9 0 1 1-8-18z" fill="#FFE7A3" />
            ) : (
              <circle cx="595" cy="26" r="9" fill="#F4F1E8" />
            )}
          </>
        )}
        <rect y="62" width="640" height="34" fill={s.sea} />
        <path d="M0 70q20-4 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0" stroke="#ffffff33" fill="none" />
        {/* King Fahd fountain */}
        <g>
          <path d={`M500 70 C498 ${s.night ? 20 : 26}, 502 ${s.night ? 20 : 26}, 500 70`} stroke="#fff" strokeWidth="3" opacity=".9" />
          <path d="M500 22q-14 10-20 46M500 22q14 10 20 46" stroke="#ffffffaa" strokeWidth="1.5" fill="none" />
          {s.night && <circle cx="500" cy="28" r="18" fill="url(#glow)" opacity=".35" />}
        </g>
        {/* Eid fireworks */}
        {eid && hour >= 18 && (
          <g className="fireworks">
            {[
              [150, 30, '#FFD166'],
              [300, 22, '#EF476F'],
              [420, 36, '#06D6A0'],
            ].map(([x, y, c], i) => (
              <g key={i} transform={`translate(${x} ${y})`} style={{ animationDelay: `${i * 0.5}s` }} className="burst">
                {Array.from({ length: 10 }, (_, k) => {
                  const a = (k / 10) * Math.PI * 2;
                  return <line key={k} x1="0" y1="0" x2={Math.cos(a) * 14} y2={Math.sin(a) * 14} stroke={c as string} strokeWidth="2" strokeLinecap="round" />;
                })}
              </g>
            ))}
          </g>
        )}
        {/* corniche walkway */}
        <rect y="96" width="640" height="14" fill="#E9D8B4" />
        {Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x={i * 40 + 8} y="101" width="20" height="4" rx="2" fill="#D8C092" />
        ))}
        {/* restaurant floor */}
        <rect x="20" y="118" width="600" height="222" rx="10" fill="#F6F1E7" stroke="#2A3563" strokeWidth="3" />
        <text x="34" y="138" fontSize="12" fontWeight="700" fill="#2A3563">
          DataBite · Jeddah
        </text>
        {/* kitchen */}
        <rect x="462" y="126" width="150" height="206" rx="8" fill="#E7ECF7" />
        <rect x="470" y="300" width="134" height="12" rx="4" fill="#B9C0DA" />
        <text x="537" y="146" fontSize="11" textAnchor="middle" fill="#5B6690" fontWeight="600">
          المطبخ
        </text>
        {Array.from({ length: cooks }, (_, i) => {
          const x = 484 + (i % 4) * 34;
          const y = 172 + Math.floor(i / 4) * 34;
          return (
            <g key={i} className="cook" style={{ animationDuration: `${speed}s`, animationDelay: `${(i % 3) * 0.12}s` }}>
              <circle cx={x} cy={y} r="10" fill="#fff" stroke="#2A3563" strokeWidth="1.5" />
              <rect x={x - 6} y={y - 15} width="12" height="7" rx="3" fill="#fff" stroke="#2A3563" strokeWidth="1.2" />
              <circle cx={x} cy={y + 1} r="4" fill="#C68B5E" />
            </g>
          );
        })}
        {/* tables */}
        {tables.map((t, i) => {
          const on = i < sim.occupied;
          return (
            <g key={i}>
              {[
                [-17, 0],
                [17, 0],
                [0, -17],
                [0, 17],
              ].map(([dx, dy], k) => (
                <circle
                  key={k}
                  cx={t.x + dx}
                  cy={t.y + dy}
                  r="6.5"
                  fill={on && (k < 3 || i % 2 === 0) ? guestColors[(i + k) % guestColors.length] : '#DCD3C2'}
                  style={{ transition: 'fill .5s', transitionDelay: `${i * 30}ms` }}
                />
              ))}
              <rect x={t.x - 11} y={t.y - 11} width="22" height="22" rx="5" fill={on ? '#fff' : '#EDE6D8'} stroke="#B8A98C" />
            </g>
          );
        })}
        {/* door */}
        <rect x="40" y="334" width="44" height="10" rx="3" fill="#2A3563" />
        {/* queue outside */}
        {Array.from({ length: sim.queue }, (_, i) => (
          <g key={i} className="queuer" style={{ animationDelay: `${i * 0.07}s` }}>
            <circle cx={62 + i * 25} cy="362" r="8" fill={sim.load > 1.6 ? '#E11D48' : '#F97316'} />
            <circle cx={62 + i * 25} cy="358" r="3.5" fill="#fff" opacity=".6" />
          </g>
        ))}
        {sim.queue === 0 && (
          <text x="100" y="366" fontSize="12" fill="#B9C0DA">
            ما فيه طابور 👌
          </text>
        )}
      </svg>
      <figcaption className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-ink-800 text-white text-center" dir="rtl">
        {[
          ['الساعة', fmtHour(hour)],
          ['الطلبات/ساعة', String(Math.round(orders))],
          ['الموظفون', String(staff)],
          ['وقت الانتظار', sim.waitLabel],
          ['مزاج العملاء', sim.mood],
        ].map(([l, v]) => (
          <div key={l} className="bg-ink-950 px-2 py-2">
            <div className="text-[11px] text-white/55">{l}</div>
            <div className="font-bold tabular-nums text-lg leading-tight" dir={l === 'الساعة' ? 'ltr' : undefined}>
              {v}
            </div>
          </div>
        ))}
      </figcaption>
      {caption && <div className="bg-ink-950 text-white/60 text-xs px-3 py-2 border-t border-white/10">{caption}</div>}
    </figure>
  );
}
