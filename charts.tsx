import { useState } from 'react';
import { cx } from './ui';

const niceMax = (v: number) => {
  const steps = [10, 20, 25, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 100) * 100;
};

export interface BarProps {
  values: number[];
  labels: string[];
  color?: string;
  highlight?: number | null;
  dim?: boolean;
  onBarClick?: (i: number) => void;
  height?: number;
  unit?: string;
  ariaLabel: string;
  compare?: { values: number[]; color: string; label: string; mainLabel: string };
  showValues?: boolean;
}

export function BarChart({ values, labels, color = '#3B6EF5', highlight, onBarClick, height = 240, unit = '', ariaLabel, compare, showValues }: BarProps) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, padL = 34, padB = 28, padT = 16;
  const max = niceMax(Math.max(...values, ...(compare?.values ?? [0])) * 1.08);
  const n = values.length;
  const slot = (W - padL - 8) / n;
  const bw = compare ? slot * 0.36 : slot * 0.62;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  return (
    <div dir="ltr" className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 4} y1={y(t)} y2={y(t)} stroke="#DCE0EE" strokeDasharray={t === 0 ? '' : '3 4'} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#8A93B5">
              {t}
            </text>
          </g>
        ))}
        {values.map((v, i) => {
          const x = padL + i * slot + (slot - (compare ? bw * 2 + 3 : bw)) / 2;
          const active = highlight === i || hover === i;
          const faded = highlight != null && highlight !== i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onBarClick?.(i)}
              className={onBarClick ? 'cursor-pointer' : ''}
            >
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              <rect
                x={x}
                y={y(v)}
                width={bw}
                height={Math.max(0, H - padB - y(v))}
                rx={4}
                fill={color}
                opacity={faded ? 0.28 : active ? 1 : 0.85}
                style={{ transition: 'all .35s ease' }}
              />
              {compare && (
                <rect
                  x={x + bw + 3}
                  y={y(compare.values[i])}
                  width={bw}
                  height={Math.max(0, H - padB - y(compare.values[i]))}
                  rx={4}
                  fill={compare.color}
                  opacity={faded ? 0.28 : 0.9}
                  style={{ transition: 'all .35s ease' }}
                />
              )}
              <text x={padL + i * slot + slot / 2} y={H - 9} textAnchor="middle" fontSize="11" fill={active ? '#111833' : '#5B6690'} fontWeight={active ? 700 : 400}>
                {labels[i]}
              </text>
              {(active || showValues) && (
                <text x={x + bw / 2} y={y(v) - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#111833">
                  {v}
                  {unit}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {onBarClick && (
        <div className="sr-only">
          {values.map((v, i) => (
            <button key={i} onClick={() => onBarClick(i)}>
              {labels[i]}: {v}
            </button>
          ))}
        </div>
      )}
      {compare && (
        <div className="flex gap-4 justify-center text-xs text-ink-600 mt-1" dir="rtl">
          <span className="flex items-center gap-1.5">
            <i className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
            {compare.mainLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-3 h-3 rounded-sm inline-block" style={{ background: compare.color }} />
            {compare.label}
          </span>
        </div>
      )}
    </div>
  );
}

export interface Series {
  name: string;
  values: (number | null)[];
  color: string;
  dashed?: boolean;
  area?: boolean;
}
export function LineChart({ series, labels, height = 220, ariaLabel, labelEvery = 1 }: { series: Series[]; labels: string[]; height?: number; ariaLabel: string; labelEvery?: number }) {
  const W = 640, H = height, padL = 34, padB = 28, padT = 14;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const max = niceMax(Math.max(...all) * 1.08);
  const n = labels.length;
  const x = (i: number) => padL + 8 + (i * (W - padL - 20)) / Math.max(1, n - 1);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  return (
    <div dir="ltr" className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 4} y1={y(t)} y2={y(t)} stroke="#DCE0EE" strokeDasharray={t === 0 ? '' : '3 4'} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#8A93B5">
              {t}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fill="#5B6690">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
          return (
            <g key={s.name}>
              {s.area && pts.length > 1 && <path d={`${d} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`} fill={s.color} opacity={0.1} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dashed ? '6 5' : ''} strokeLinejoin="round" />
              {pts.length <= 31 && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="white" stroke={s.color} strokeWidth={2} />)}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="flex gap-4 justify-center text-xs text-ink-600 mt-1 flex-wrap" dir="rtl">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <i className="w-4 h-0.5 inline-block" style={{ background: s.color, borderTop: s.dashed ? `2px dashed ${s.color}` : undefined }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Heatmap({
  matrix,
  rowLabels,
  colLabels,
  color = '#3B6EF5',
  onCell,
  selected,
  ariaLabel,
}: {
  matrix: number[][];
  rowLabels: string[];
  colLabels: string[];
  color?: string;
  onCell?: (r: number, c: number) => void;
  selected?: [number, number] | null;
  ariaLabel: string;
}) {
  const flat = matrix.flat();
  const min = Math.min(...flat), max = Math.max(...flat);
  return (
    <div className="overflow-x-auto -mx-1 px-1" role="group" aria-label={ariaLabel}>
      <table dir="ltr" className="border-separate border-spacing-1 mx-auto text-xs">
        <thead>
          <tr>
            <th />
            {colLabels.map((c) => (
              <th key={c} className="font-medium text-ink-500 px-0.5">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, r) => (
            <tr key={r}>
              <th className="text-right pr-2 font-medium text-ink-600 whitespace-nowrap" dir="rtl">
                {rowLabels[r]}
              </th>
              {row.map((v, c) => {
                const t = (v - min) / (max - min || 1);
                const isSel = selected && selected[0] === r && selected[1] === c;
                return (
                  <td key={c} className="p-0">
                    <button
                      type="button"
                      onClick={() => onCell?.(r, c)}
                      disabled={!onCell}
                      aria-label={`${rowLabels[r]} ${colLabels[c]}: ${v}`}
                      className={cx(
                        'w-8 h-8 sm:w-10 sm:h-9 rounded-md text-[10px] sm:text-[11px] font-semibold tabular-nums transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900',
                        onCell ? 'hover:scale-110' : 'cursor-default',
                        isSel && 'ring-2 ring-ink-900 scale-110',
                      )}
                      style={{ background: color, opacity: 0.12 + t * 0.88, color: t > 0.45 ? 'white' : '#111833' }}
                    >
                      {Math.round(v)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Scatter({ points, color, xLabel, yLabel, ariaLabel, height = 200 }: { points: [number, number][]; color: string; xLabel: string; yLabel: string; ariaLabel: string; height?: number }) {
  const W = 320, H = height, pad = 30;
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = niceMax(Math.max(...ys));
  const x = (v: number) => pad + ((v - x0) / (x1 - x0 || 1)) * (W - pad - 10);
  const y = (v: number) => 10 + (H - pad - 10) * (1 - v / y1);
  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
        <line x1={pad} x2={W - 6} y1={H - pad} y2={H - pad} stroke="#B9C0DA" />
        <line x1={pad} x2={pad} y1={8} y2={H - pad} stroke="#B9C0DA" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p[0])} cy={y(p[1])} r={2.6} fill={color} opacity={0.45} />
        ))}
        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#5B6690">
          {xLabel}
        </text>
        <text x={10} y={H / 2} textAnchor="middle" fontSize="11" fill="#5B6690" transform={`rotate(-90 10 ${H / 2})`}>
          {yLabel}
        </text>
      </svg>
    </div>
  );
}

export function Donut({ parts, size = 150, ariaLabel }: { parts: { label: string; value: number; color: string }[]; size?: number; ariaLabel: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-4 justify-center">
      <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={ariaLabel}>
        <g transform="rotate(-90 70 70)">
          {parts.map((p) => {
            const len = (p.value / total) * c;
            const el = <circle key={p.label} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="22" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </g>
      </svg>
      <ul className="text-sm space-y-1.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <i className="w-3 h-3 rounded-sm inline-block" style={{ background: p.color }} />
            <span>{p.label}</span>
            <b className="tabular-nums">{Math.round((p.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
