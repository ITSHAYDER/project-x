export interface Point {
  day: string;
  value: number;
}

/** Server-rendered SVG sparkline with the person's own baseline band. Color is never the only signal. */
export function Sparkline({ points, band, width = 280, height = 56, label }: { points: Point[]; band?: { lo: number; hi: number } | null; width?: number; height?: number; label: string }) {
  if (points.length < 2) {
    return (
      <div className="text-sm text-muted" role="img" aria-label={`${label}: not enough entries yet`}>
        Not enough entries yet
      </div>
    );
  }
  const vals = points.map((p) => p.value).concat(band ? [band.lo, band.hi] : []);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pad = 4;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / (points.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - 2 * pad);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }} role="img" aria-label={`${label}: last ${points.length} days, latest ${last.value}`}>
      {band ? <rect x={pad} width={width - 2 * pad} y={y(band.hi)} height={Math.max(2, y(band.lo) - y(band.hi))} fill="var(--accent-soft)" /> : null}
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="3.2" fill="var(--accent)" />
    </svg>
  );
}
