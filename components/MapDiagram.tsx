import type { MapNode } from '@/lib/domain/types';
import type { EdgeSummary } from '@/lib/domain/map/summaries';

const COL: Record<MapNode['kind'], number> = { context: 0, situation: 0, thought: 1, emotion: 2, body: 2, behavior: 3, strength: 4, intervention: 4, signal: 5 };
const W = 168, H = 40, GX = 36, GY = 14;

const STROKE: Record<string, { color: string; dash?: string }> = {
  observed: { color: 'var(--accent)' },
  confirmed_together: { color: 'var(--accent)' },
  emerging: { color: 'var(--muted)', dash: '2 4' },
  clinician_hypothesis: { color: 'var(--amber)', dash: '7 5' },
  patient_belief: { color: 'var(--ink)', dash: '7 5' },
  proposed: { color: 'var(--muted)', dash: '2 4' },
};

export const STATUS_LABEL: Record<string, string> = {
  observed: 'Observed in your entries',
  confirmed_together: 'Confirmed together',
  emerging: 'Emerging',
  clinician_hypothesis: 'Clinician hypothesis',
  patient_belief: 'Patient belief',
  proposed: 'Suggested',
  dismissed: 'Dismissed',
};

/** Deterministic layout: stable between visits. Mobile users get the list below as the primary view. */
export function MapDiagram({ nodes, summaries }: { nodes: MapNode[]; summaries: EdgeSummary[] }) {
  const used = [...new Set(nodes.map((n) => COL[n.kind]))].sort((a, b) => a - b);
  const colIndex = new Map(used.map((c, i) => [c, i]));
  const rows = new Map<number, number>();
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const c = colIndex.get(COL[n.kind]) ?? 0;
    const r = rows.get(c) ?? 0;
    rows.set(c, r + 1);
    pos.set(n.id, { x: c * (W + GX) + 8, y: r * (H + GY) + 8 });
  }
  const width = used.length * (W + GX) + 8;
  const height = Math.max(1, ...[...rows.values()]) * (H + GY) + 16;
  const visible = summaries.filter((s) => s.shown !== 'dismissed');
  return (
    <div
      className="overflow-x-auto rounded-xl border border-line bg-card p-2"
      role="region"
      aria-label="Scrollable Map diagram"
      tabIndex={0}
    >
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Map of how your situations, thoughts, feelings, behaviors and signals connect. A list of the same links follows.">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
          </marker>
        </defs>
        {visible.map((s) => {
          const a = pos.get(s.edge.from);
          const b = pos.get(s.edge.to);
          if (!a || !b) return null;
          const st = STROKE[s.shown] ?? STROKE.proposed;
          const sw = 1.5 + Math.min(s.days, 12) * 0.35;
          const same = a.x === b.x;
          const x1 = a.x + W, y1 = a.y + H / 2;
          const x2 = same ? b.x + W : b.x, y2 = b.y + H / 2;
          const back = !same && b.x < a.x;
          const d = same
            ? `M${x1},${y1} C${x1 + 34},${y1} ${x2 + 34},${y2} ${x2},${y2}`
            : back
              ? `M${a.x},${y1} C${a.x - 30},${y1} ${b.x + W + 30},${y2} ${b.x + W},${y2}`
              : `M${x1},${y1} C${x1 + 24},${y1} ${x2 - 24},${y2} ${x2},${y2}`;
          return <path key={s.edge.id} d={d} fill="none" stroke={st.color} strokeWidth={sw} strokeDasharray={st.dash} opacity="0.85" markerEnd="url(#arr)" />;
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const fill = n.kind === 'intervention' ? 'var(--accent-soft)' : 'var(--paper)';
          return (
            <g key={n.id}>
              <rect x={p.x} y={p.y} width={W} height={H} rx="9" fill={fill} stroke="var(--line)" />
              <text x={p.x + W / 2} y={p.y + H / 2 + 4} textAnchor="middle" fontSize="12.5" fill="var(--ink)">
                {n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label}
              </text>
              <text x={p.x + 8} y={p.y + 11} fontSize="9" fill="var(--muted)">
                {n.kind}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        <li>Solid line: seen in entries</li>
        <li>Long dashes: belief or hypothesis, no data yet</li>
        <li>Dots: emerging or suggested</li>
        <li>Thicker line: more days of evidence</li>
      </ul>
    </div>
  );
}
