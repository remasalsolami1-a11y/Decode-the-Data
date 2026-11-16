import type { Character } from './stations';

/** Original, friendly team characters drawn in SVG (no external art). */
export function Avatar({
  c,
  size = 56,
  bg = '#E8EBF5',
  mood = 'happy',
  className = '',
}: {
  c: Character;
  size?: number;
  bg?: string;
  mood?: 'happy' | 'worried' | 'clap';
  className?: string;
}) {
  const body = c.look === 'shemagh' ? '#FFFFFF' : c.look === 'hijab' ? '#23273D' : c.look === 'hijabLight' ? '#5B4B73' : '#3B6EF5';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill={bg} />
      <circle cx="32" cy="32" r="31" fill="none" stroke="#11183322" strokeWidth="1.5" />
      <clipPath id={`clip-${c.name}`}>
        <circle cx="32" cy="32" r="32" />
      </clipPath>
      <g clipPath={`url(#clip-${c.name})`}>
        {/* shoulders */}
        <path d="M8 66c1-14 11-21 24-21s23 7 24 21z" fill={body} stroke="#0B102022" strokeWidth="1" />
        {c.look === 'cap' && <path d="M26 46l6 7 6-7" fill="none" stroke="#fff" strokeWidth="2" />}
        {/* back of head-cover */}
        {(c.look === 'hijab' || c.look === 'hijabLight') && <path d="M14 30c0-12 8-19 18-19s18 7 18 19v16c-4 4-11 6-18 6s-14-2-18-6z" fill={c.look === 'hijab' ? '#2E3350' : '#8E6C9E'} />}
        {c.look === 'shemagh' && (
          <>
            <path d="M13 28c1-11 9-17 19-17s18 6 19 17l3 20c-6 4-14 6-22 6s-16-2-22-6z" fill="#FFFFFF" stroke="#E4E6EE" />
            <path d="M15 30c2-10 9-15 17-15s15 5 17 15l2 16c-5 3-12 4-19 4s-14-1-19-4z" fill="#D63A3A" opacity=".92" />
            <path d="M20 20l26 26M30 14l18 18M44 18L22 40M50 28L32 46" stroke="#fff" strokeWidth=".8" opacity=".35" />
          </>
        )}
        {/* face */}
        <ellipse cx="32" cy="31" rx="10.5" ry="12" fill={c.skin} />
        {c.look === 'cap' && <path d="M21 28c0-9 5-13 11-13s11 4 11 13c-3-4-7-6-11-6s-8 2-11 6z" fill="#1E1E28" />}
        {c.look === 'shemagh' && <path d="M19 24c3-7 8-9 13-9s10 2 13 9" fill="none" stroke="#1E1E28" strokeWidth="3.4" strokeLinecap="round" />}
        {(c.look === 'hijab' || c.look === 'hijabLight') && (
          <path d="M20 30c0-10 5-15 12-15s12 5 12 15c0-6-5-11-12-11s-12 5-12 11z" fill={c.look === 'hijab' ? '#2E3350' : '#8E6C9E'} />
        )}
        {/* eyes */}
        {mood === 'worried' ? (
          <>
            <path d="M26.5 30l3-1M37.5 30l-3-1" stroke="#1E1E28" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="28" cy="32.5" r="1.5" fill="#1E1E28" />
            <circle cx="36" cy="32.5" r="1.5" fill="#1E1E28" />
            <path d="M28.5 39q3.5-2.5 7 0" stroke="#1E1E28" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="28" cy="31.5" r="1.3" fill="#1E1E28" />
            <circle cx="36" cy="31.5" r="1.3" fill="#1E1E28" />
            <path d="M28.5 37.5q3.5 2.2 7 0" stroke="#1E1E28" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </>
        )}
        {c.look === 'cap' && (
          <g fill="none" stroke="#1E1E28" strokeWidth="1.2">
            <circle cx="28" cy="31" r="3.3" />
            <circle cx="36" cy="31" r="3.3" />
            <path d="M31.3 31h1.4" />
          </g>
        )}
        {/* agal */}
        {c.look === 'shemagh' && <ellipse cx="32" cy="16.5" rx="12.5" ry="3" fill="none" stroke="#14141C" strokeWidth="2.6" />}
        {mood === 'clap' && (
          <g className="clap-hands">
            <ellipse cx="27" cy="54" rx="4" ry="5" fill={c.skin} />
            <ellipse cx="37" cy="54" rx="4" ry="5" fill={c.skin} />
          </g>
        )}
      </g>
    </svg>
  );
}
