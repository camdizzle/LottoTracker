import { useState } from 'react';

// Sequential blue ramp (dark → light) for a dark surface. Zero gets its own
// recessive cell so "never" reads differently from "rarely".
const RAMP = [
  { bg: '#184f95', fg: '#ffffff' },
  { bg: '#256abf', fg: '#ffffff' },
  { bg: '#3987e5', fg: '#ffffff' },
  { bg: '#6da7ec', fg: '#0f172a' },
  { bg: '#9ec5f4', fg: '#0f172a' },
  { bg: '#cde2fb', fg: '#0f172a' },
];
const ZERO = { bg: '#334155', fg: '#94a3b8' };

function cellStyle(count, max) {
  if (!count || !max) return ZERO;
  const idx = Math.min(RAMP.length - 1, Math.ceil((count / max) * RAMP.length) - 1);
  return RAMP[Math.max(0, idx)];
}

/**
 * Number-frequency grid.
 * stats: Map<number, { count, last }> — last is a YYYY-MM-DD string or null.
 * verb: "drawn" | "played", used in the inspector text.
 */
export default function Heatmap({ title, max, stats, verb }) {
  const [active, setActive] = useState(null);
  let maxCount = 0;
  for (const s of stats.values()) maxCount = Math.max(maxCount, s.count);

  const numbers = Array.from({ length: max }, (_, i) => i + 1);
  const activeStat = active != null ? stats.get(active) : null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-300">{title}</h4>
        <Legend maxCount={maxCount} />
      </div>
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}
        onMouseLeave={() => setActive(null)}
      >
        {numbers.map((n) => {
          const s = stats.get(n);
          const count = s?.count || 0;
          const st = cellStyle(count, maxCount);
          return (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setActive(n)}
              onFocus={() => setActive(n)}
              onClick={() => setActive(n)}
              aria-label={`${n}: ${verb} ${count} times`}
              className={`aspect-square rounded text-xs font-semibold flex items-center justify-center ${
                active === n ? 'ring-2 ring-yellow-400' : ''
              }`}
              style={{ backgroundColor: st.bg, color: st.fg }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-slate-400 mt-2 h-4">
        {active != null
          ? `#${active}: ${verb} ${activeStat?.count || 0}×${
              activeStat?.last ? ` · last ${activeStat.last}` : ''
            }`
          : 'Hover or tap a number for details'}
      </div>
    </div>
  );
}

function Legend({ maxCount }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-slate-400">
      <span>0</span>
      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ZERO.bg }} />
      {RAMP.map((r) => (
        <span key={r.bg} className="w-3 h-3 rounded-sm" style={{ backgroundColor: r.bg }} />
      ))}
      <span>{maxCount}</span>
    </div>
  );
}
