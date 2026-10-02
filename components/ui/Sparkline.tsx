// A small, honest line chart -- no library needed. Deliberately plain:
// it shows patient-reported values over time and nothing more. It does
// not annotate, smooth, or interpret the data (see Section 18/61 of the
// architecture doc: never imply a causal or clinical conclusion the
// underlying numbers can't support).
export function Sparkline({
  values,
  max = 5,
  color = "#3F5D52",
}: {
  values: (number | null)[];
  max?: number;
  color?: string;
}) {
  const width = 280;
  const height = 56;
  const padding = 4;

  const points = values
    .map((v, i) => {
      if (v === null) return null;
      const x = padding + (i / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (v / max) * (height - padding * 2);
      return `${x},${y}`;
    })
    .filter(Boolean);

  if (points.length === 0) {
    return (
      <div className="flex h-14 items-center text-xs text-ink/40">
        Not enough data yet
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-14 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend over time"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
