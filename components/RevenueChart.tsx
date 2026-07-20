'use client';

import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';

type Point = { label: string; value: number };

const W = 720;
const H = 240;
const PAD_T = 14;
const PAD_B = 16;

const PERIODS = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
];

/** Smooth cubic path (horizontal-tangent) through the points. */
function buildPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const midX = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C ${midX} ${pts[i - 1].y}, ${midX} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

export default function RevenueChart({
  series,
  currency,
}: {
  series: Point[];
  currency: string;
}) {
  const [months, setMonths] = useState(12);
  const data = useMemo(() => series.slice(Math.max(0, series.length - months)), [series, months]);

  const { linePath, areaPath, gridValues, xLabels, change, pct, positive } = useMemo(() => {
    const values = data.map((d) => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values, max * 0.85); // keep some baseline headroom
    const span = max - min || 1;
    const n = data.length;
    const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
    const y = (v: number) => PAD_B + (1 - (v - min) / span) * (H - PAD_T - PAD_B);
    const pts = data.map((d, i) => ({ x: x(i), y: y(d.value) }));

    const line = buildPath(pts);
    const area = pts.length
      ? `${line} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`
      : '';

    const grid = [0, 0.25, 0.5, 0.75].map((f) => Math.round(max - f * span));
    const labels = data.map((d) => d.label);
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    const diff = last - first;

    return {
      linePath: line,
      areaPath: area,
      gridValues: grid,
      xLabels: labels,
      change: diff,
      pct: first > 0 ? ((diff / first) * 100).toFixed(1) : '0.0',
      positive: diff >= 0,
    };
  }, [data]);

  return (
    <div>
      {/* Period toggle + change badge */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setMonths(p.months)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                months === p.months
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            positive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}
        >
          {positive ? '+' : ''}
          {formatCurrency(change, currency)}
          <span className="opacity-70">({positive ? '+' : ''}{pct}%)</span>
        </span>
      </div>

      {/* Chart */}
      <div className="relative h-[240px] w-full">
        {/* Y gridline labels */}
        <div className="pointer-events-none absolute inset-0">
          {gridValues.map((v, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 flex items-center"
              style={{ top: `${(i / 4) * (100 - (PAD_T / H) * 100)}%` }}
            >
              <span className="w-10 pr-1 text-right font-mono text-[10px] text-gray-400">
                {v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              </span>
              <span className="h-px flex-1 border-t border-dashed border-gray-100" />
            </div>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full pl-10"
          aria-hidden
        >
          <defs>
            <linearGradient id="partnerRevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F15A29" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#F15A29" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#partnerRevGradient)" />
          <path
            d={linePath}
            fill="none"
            stroke="#F15A29"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* X labels */}
      <div className="mt-2 flex justify-between pl-10 font-mono text-[10px] text-gray-400">
        {xLabels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </div>
  );
}
