import { useEffect, useRef, useState } from 'react';
import { STATIONS } from './stations';
import type { Tier } from './project';
import { TIER_COLOR } from './project';
import type { StationId } from './store';

export type RiverStatus = Tier | 'pending';
export interface RiverNode {
  id: StationId;
  status: RiverStatus;
  current?: boolean;
}

const CLEAN = '#22D3EE';
const SHORT = ['الهندسة', 'التحليل', 'العلوم', 'تعلم الآلة', 'الأعمال', 'الحوكمة'];
const PENDING = 'rgba(255,255,255,0.18)';
const rank: Record<RiverStatus, number> = { pending: -1, best: 0, cost: 1, harm: 2 };
const colorOf = (s: RiverStatus) => (s === 'pending' ? PENDING : s === 'best' ? CLEAN : TIER_COLOR[s]);

/**
 * The "data river": particles carry the participant's data from station 1 (right) to station 6 (left).
 * A station's decision tints the data that leaves it — and a harmful one keeps flowing downstream,
 * so the contamination is visible in every station after it.
 */
export function DataRiver({ nodes, height = 170, onSelect, canSelect, labels = true }: { nodes: RiverNode[]; height?: number; onSelect?: (id: StationId) => void; canSelect?: (id: StationId) => boolean; labels?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef(nodes);
  // contamination front: when a decision changes, the new colour travels downstream from that station
  const front = useRef<{ from: number; t: number; prev: RiverStatus[] } | null>(null);
  const lastKey = useRef(nodes.map((n) => n.status).join());
  const [w, setW] = useState(0);

  useEffect(() => {
    const key = nodes.map((n) => n.status).join();
    if (key !== lastKey.current) {
      const prevStatuses = lastKey.current.split(',') as RiverStatus[];
      const from = nodes.findIndex((n, i) => n.status !== prevStatuses[i]);
      front.current = { from: Math.max(0, from), t: 0, prev: prevStatuses };
      lastKey.current = key;
    }
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let W = 0;
    const H = height;
    const resize = () => {
      const r = window.devicePixelRatio || 1;
      W = cv.clientWidth;
      setW(W);
      cv.width = W * r;
      cv.height = H * r;
      ctx.setTransform(r, 0, 0, r, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const pad = () => Math.max(28, Math.min(48, W * 0.06));
    const nodeX = (i: number) => W - pad() - i * ((W - 2 * pad()) / 5);
    const midY = labels ? H / 2 - 6 : H / 2;
    const amp = Math.min(16, H * 0.09);
    const yAt = (x: number) => midY + Math.sin(x / 75) * amp;
    const N = Math.round(Math.max(40, Math.min(110, W / 7)));
    const ps = Array.from({ length: N }, () => ({ x: Math.random() * 2000, s: 0.45 + Math.random() * 0.9, o: (Math.random() - 0.5) * 9, r: 1.6 + Math.random() * 1.6 }));

    // the status that colours data at position x = worst decision among stations it has already passed
    const statusAt = (x: number, statuses: RiverStatus[]) => {
      let worst: RiverStatus = 'pending';
      for (let i = 0; i < statuses.length; i++) {
        if (nodeX(i) < x - 2) break;
        const s = statuses[i];
        if (s === 'pending') return worst === 'pending' ? 'pending' : worst;
        if (rank[s] > rank[worst]) worst = s;
      }
      return worst;
    };
    const reach = (statuses: RiverStatus[]) => {
      // data flows up to the station after the last decided one
      let last = -1;
      statuses.forEach((s, i) => s !== 'pending' && (last = i));
      return last >= 5 ? pad() - 16 : nodeX(Math.min(5, last + 1));
    };

    let raf = 0;
    const draw = () => {
      const nodes = nodesRef.current;
      const statuses = nodes.map((n) => n.status);
      const f = front.current;
      if (f) {
        f.t += reduce ? 9999 : 3.2;
        if (f.t > W) front.current = null;
      }
      ctx.clearRect(0, 0, W, H);

      // riverbed
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let x = pad() - 16; x <= W - pad() + 16; x += 4) x === pad() - 16 ? ctx.moveTo(x, yAt(x)) : ctx.lineTo(x, yAt(x));
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 18;
      ctx.stroke();

      const end = reach(statuses);
      const top = W - pad() + 16;
      for (const p of ps) {
        if (!reduce) p.x -= p.s;
        if (p.x < end || p.x > top + 30) p.x = end + ((p.x % (top - end)) + (top - end)) % (top - end);
        if (!reduce && p.x - p.s < end) p.x = top + Math.random() * 20;
        let st = statusAt(p.x, statuses);
        if (f && p.x < nodeX(f.from) + 2 && p.x < nodeX(f.from) - f.t) st = statusAt(p.x, f.prev);
        const c = colorOf(st === 'pending' ? 'best' : st);
        ctx.beginPath();
        ctx.arc(p.x, yAt(p.x) + p.o, p.r, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.85;
        ctx.shadowColor = c;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      const now = performance.now();
      nodes.forEach((n, i) => {
        const x = nodeX(i);
        const y = yAt(x);
        const meta = STATIONS[i];
        const st = n.status;
        // downstream of a harmful decision → "affected"
        const affected = st !== 'harm' && statuses.slice(0, i).some((s) => s === 'harm') && st !== 'pending';
        const ring = st === 'pending' ? 'rgba(255,255,255,0.25)' : affected ? TIER_COLOR.harm : colorOf(st);
        if (n.current && !reduce) {
          const k = (now / 900) % 1;
          ctx.beginPath();
          ctx.arc(x, y, 15 + k * 12, 0, Math.PI * 2);
          ctx.strokeStyle = meta.color;
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#0B1024';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = ring;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = st === 'pending' ? 'rgba(255,255,255,0.12)' : meta.color;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x, y + 0.5);
        if (labels) {
          ctx.font = '600 12px "IBM Plex Sans Arabic", system-ui, sans-serif';
          ctx.fillStyle = st === 'pending' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.9)';
          const ly = i % 2 ? y - 30 : y + 31;
          ctx.fillText(W < 560 ? SHORT[i] : meta.ar, x, ly);
          if (affected) {
            ctx.font = '600 10px "IBM Plex Sans Arabic", system-ui, sans-serif';
            ctx.fillStyle = TIER_COLOR.harm;
            ctx.fillText('متأثرة', x, i % 2 ? ly - 14 : ly + 14);
          }
        }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height, labels]);

  const summary = nodes
    .map((n, i) => `${i + 1}. ${STATIONS[i].ar}: ${n.status === 'pending' ? 'لم تُنجز بعد' : n.status === 'best' ? 'قرار ممتاز' : n.status === 'cost' ? 'مقبول مع تكلفة' : 'قرار ضار'}`)
    .join('، ');

  return (
    <div className="relative" dir="ltr">
      <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} role="img" aria-label={`نهر البيانات: ${summary}`} />
      {onSelect &&
        w > 0 &&
        nodes.map((n, i) => {
          if (canSelect && !canSelect(n.id)) return null;
          const pad = Math.max(28, Math.min(48, w * 0.06));
          const x = w - pad - i * ((w - 2 * pad) / 5);
          return (
            <button
              key={n.id}
              onClick={() => onSelect(n.id)}
              className="absolute top-0 h-full w-14 -translate-x-1/2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 hover:bg-white/5"
              style={{ left: x }}
              aria-label={`افتح محطة ${STATIONS[i].ar}`}
              title={STATIONS[i].ar}
            />
          );
        })}
    </div>
  );
}
