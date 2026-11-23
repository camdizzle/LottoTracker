import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTickets, getResults, checkAuth } from '../api.js';
import { evaluateTicket, getSpecialValue } from '../prizes.js';
import { formatCents } from '../format.js';
import Ball from '../components/Ball.jsx';
import Heatmap from '../components/Heatmap.jsx';

const GAMES = {
  megaMillions: { label: 'Mega Millions', whiteMax: 70, specialMax: 24, specialLabel: 'Mega Ball' },
  powerball: { label: 'Powerball', whiteMax: 69, specialMax: 26, specialLabel: 'Powerball' },
  superLotto: { label: 'Super Lotto Plus', whiteMax: 47, specialMax: 27, specialLabel: 'Mega Number' },
};
const GAME_KEYS = Object.keys(GAMES);

// Dark-surface categorical slots 1 and 2 (validated against slate-800).
const WON_COLOR = '#3987e5';
const SPENT_COLOR = '#d95926';

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function findResult(results, ticket) {
  return (results?.[ticket.game] || []).find((r) => r.drawDate === ticket.drawDate) || null;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function emptyTotals() {
  return { spent: 0, won: 0, tickets: 0, evaluated: 0, winners: 0, jackpots: 0 };
}

function computePerformance(tickets, results) {
  const today = todayStr();
  const overall = emptyTotals();
  const byGame = Object.fromEntries(GAME_KEYS.map((g) => [g, emptyTotals()]));
  const byMonth = new Map();
  const tiers = Object.fromEntries(GAME_KEYS.map((g) => [g, new Map()]));
  const wins = [];
  let pending = 0;
  let missing = 0;

  for (const t of tickets) {
    const r = findResult(results, t);
    const cost = t.costCents || 0;
    const ev = evaluateTicket(t, r);
    const won = Math.round((ev.prize.amount || 0) * 100);
    const buckets = [overall, byGame[t.game]].filter(Boolean);

    const month = (t.drawDate || '').slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, { month, spent: 0, won: 0 });
    const m = byMonth.get(month);
    m.spent += cost;
    m.won += won;

    for (const b of buckets) {
      b.spent += cost;
      b.won += won;
      b.tickets += 1;
    }

    if (!r) {
      if ((t.drawDate || '') >= today) pending += 1;
      else missing += 1;
      continue;
    }
    for (const b of buckets) b.evaluated += 1;

    if (won > 0 || ev.prize.isJackpot) {
      for (const b of buckets) {
        b.winners += 1;
        if (ev.prize.isJackpot) b.jackpots += 1;
      }
      wins.push({ ticket: t, result: r, ev, won });
      const key = `${ev.matchedWhite.length}_${ev.specialMatched}`;
      const tm = tiers[t.game];
      if (tm) {
        const cur = tm.get(key) || {
          white: ev.matchedWhite.length,
          special: ev.specialMatched,
          count: 0,
          total: 0,
        };
        cur.count += 1;
        cur.total += won;
        tm.set(key, cur);
      }
    }
  }

  wins.sort((a, b) => b.won - a.won || b.ticket.drawDate.localeCompare(a.ticket.drawDate));
  const months = [...byMonth.values()]
    .filter((m) => m.month)
    .sort((a, b) => a.month.localeCompare(b.month));

  return { overall, byGame, months, tiers, topWins: wins.slice(0, 5), pending, missing };
}

function bump(map, n, date) {
  if (n == null || Number.isNaN(n)) return;
  const cur = map.get(n) || { count: 0, last: null };
  cur.count += 1;
  if (date && (!cur.last || date > cur.last)) cur.last = date;
  map.set(n, cur);
}

function computeFrequencies(game, tickets, results) {
  const draws = [...(results?.[game] || [])].sort((a, b) => b.drawDate.localeCompare(a.drawDate));
  const drawnWhite = new Map();
  const drawnSpecial = new Map();
  // Draws since each number last appeared (0 = in the latest draw).
  const whiteGap = new Map();
  const specialGap = new Map();
  draws.forEach((d, i) => {
    for (const n of d.whiteNumbers || []) {
      bump(drawnWhite, n, d.drawDate);
      if (!whiteGap.has(n)) whiteGap.set(n, i);
    }
    const s = getSpecialValue(game, d);
    bump(drawnSpecial, s, d.drawDate);
    if (s != null && !specialGap.has(s)) specialGap.set(s, i);
  });

  const playedWhite = new Map();
  const playedSpecial = new Map();
  let playedCount = 0;
  for (const t of tickets) {
    if (t.game !== game) continue;
    playedCount += 1;
    for (const n of t.numbers || []) bump(playedWhite, n, t.drawDate);
    bump(playedSpecial, t.specialNumber, t.drawDate);
  }

  const cfg = GAMES[game];
  const maxKey = (m) => Math.max(0, ...m.keys());
  return {
    draws,
    drawnWhite,
    drawnSpecial,
    whiteGap,
    specialGap,
    playedWhite,
    playedSpecial,
    playedCount,
    whiteMax: Math.max(cfg.whiteMax, maxKey(drawnWhite), maxKey(playedWhite)),
    specialMax: Math.max(cfg.specialMax, maxKey(drawnSpecial), maxKey(playedSpecial)),
  };
}

// ─── Prediction ("just for fun") ──────────────────────────────────────────────

function scoreNumbers(max, mode, counts, gaps, drawCount) {
  const out = [];
  for (let n = 1; n <= max; n++) {
    const count = counts.get(n)?.count || 0;
    const gap = gaps.has(n) ? gaps.get(n) : drawCount; // never drawn = coldest
    const score = mode === 'hot' ? count : gap;
    out.push({ n, score, count, gap });
  }
  // Ties: hot prefers more recent; cold prefers fewer total hits.
  out.sort((a, b) =>
    b.score - a.score ||
    (mode === 'hot' ? a.gap - b.gap : a.count - b.count) ||
    a.n - b.n
  );
  return out;
}

function weightedSample(pool, k) {
  const items = pool.map((p) => ({ ...p, w: Math.max(1, p.score) }));
  const picked = [];
  while (picked.length < k && items.length) {
    const total = items.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    let i = 0;
    while (i < items.length - 1 && r >= items[i].w) {
      r -= items[i].w;
      i += 1;
    }
    picked.push(items.splice(i, 1)[0]);
  }
  return picked;
}

function makePick(freq, mode, reroll) {
  const n = freq.draws.length;
  const whites = scoreNumbers(freq.whiteMax, mode, freq.drawnWhite, freq.whiteGap, n);
  const specials = scoreNumbers(freq.specialMax, mode, freq.drawnSpecial, freq.specialGap, n);
  const w = reroll ? weightedSample(whites.slice(0, 15), 5) : whites.slice(0, 5);
  const s = reroll ? weightedSample(specials.slice(0, 5), 1) : specials.slice(0, 1);
  return {
    whites: w.map((x) => x.n).sort((a, b) => a - b),
    special: s[0]?.n ?? null,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [game, setGame] = useState('megaMillions');

  useEffect(() => {
    let pw = '';
    try {
      pw = localStorage.getItem('adminPw') || '';
    } catch {
      pw = '';
    }
    (pw ? checkAuth(pw) : Promise.resolve(false))
      .then((ok) => {
        if (!ok) {
          navigate('/admin', { replace: true });
          return null;
        }
        setAuthed(true);
        return Promise.all([getTickets(), getResults()]).then(([t, r]) => {
          setTickets(t);
          setResults(r);
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const perf = useMemo(() => computePerformance(tickets, results), [tickets, results]);
  const freq = useMemo(() => computeFrequencies(game, tickets, results), [game, tickets, results]);

  if (loading) return <div className="text-center py-12 text-slate-400">Loading…</div>;
  if (error) return <div className="text-center py-12 text-red-400">{error}</div>;
  if (!authed) return null;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <Link to="/admin" className="text-sm text-slate-300 hover:text-white">
          ← Back to Admin
        </Link>
      </div>

      <PerformanceSection perf={perf} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">Numbers</h3>
          <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
            {GAME_KEYS.map((g) => (
              <button
                key={g}
                onClick={() => setGame(g)}
                className={`text-sm px-3 py-1 rounded ${
                  game === g ? 'bg-slate-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                {GAMES[g].label}
              </button>
            ))}
          </div>
        </div>
        <HeatmapSection game={game} freq={freq} />
        <PredictionBox key={game} game={game} freq={freq} />
      </section>
    </div>
  );
}

// ─── Performance ──────────────────────────────────────────────────────────────

function Tile({ label, value, sub }) {
  return (
    <div className="rounded-xl p-4 bg-slate-800">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-2xl font-bold mt-1 text-slate-100">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function pct(n, d) {
  return d ? `${((n / d) * 100).toFixed(1)}%` : '—';
}

function returnPerDollar(won, spent) {
  return spent ? `$${(won / spent).toFixed(2)}` : '—';
}

function PerformanceSection({ perf }) {
  const { overall, byGame, months, tiers, topWins, pending, missing } = perf;
  const net = overall.won - overall.spent;
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-bold">Performance</h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Tile label="Spent" value={formatCents(overall.spent)} />
        <Tile label="Won" value={formatCents(overall.won)} sub={overall.jackpots ? `+ ${overall.jackpots} jackpot` : null} />
        <Tile label="Net" value={formatCents(net)} sub={net < 0 ? 'down' : 'up'} />
        <Tile label="Return per $1" value={returnPerDollar(overall.won, overall.spent)} />
        <Tile
          label="Win rate"
          value={pct(overall.winners, overall.evaluated)}
          sub={`${overall.winners} of ${overall.evaluated} checked tickets`}
        />
        <Tile label="Tickets played" value={overall.tickets.toLocaleString()} />
      </div>

      {(pending > 0 || missing > 0) && (
        <p className="text-xs text-slate-400">
          {pending > 0 && `${pending} ticket${pending === 1 ? '' : 's'} waiting on upcoming draws. `}
          {missing > 0 &&
            `${missing} past ticket${missing === 1 ? ' has' : 's have'} no draw result stored, so ${
              missing === 1 ? 'it counts' : 'they count'
            } as $0 won. Enter those draws on the Admin page to include them.`}
        </p>
      )}

      <div className="bg-slate-800 rounded-xl p-4 overflow-x-auto">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">By game</h4>
        <table className="w-full text-sm tabular-nums whitespace-nowrap [&_td+td]:pl-4 [&_th+th]:pl-4">
          <thead className="text-slate-400 text-xs uppercase">
            <tr>
              <th className="text-left font-medium py-1">Game</th>
              <th className="text-right font-medium">Tickets</th>
              <th className="text-right font-medium">Spent</th>
              <th className="text-right font-medium">Won</th>
              <th className="text-right font-medium">Net</th>
              <th className="text-right font-medium">Per $1</th>
              <th className="text-right font-medium">Win rate</th>
            </tr>
          </thead>
          <tbody>
            {GAME_KEYS.map((g) => {
              const b = byGame[g];
              return (
                <tr key={g} className="border-t border-slate-700">
                  <td className="py-2 whitespace-nowrap">{GAMES[g].label}</td>
                  <td className="text-right">{b.tickets}</td>
                  <td className="text-right">{formatCents(b.spent)}</td>
                  <td className="text-right">{formatCents(b.won)}</td>
                  <td className="text-right">{formatCents(b.won - b.spent)}</td>
                  <td className="text-right">{returnPerDollar(b.won, b.spent)}</td>
                  <td className="text-right">{pct(b.winners, b.evaluated)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MonthlyChart months={months} />

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Top wins</h4>
          {topWins.length === 0 ? (
            <p className="text-sm text-slate-400">No wins yet.</p>
          ) : (
            <ul className="space-y-3">
              {topWins.map(({ ticket, ev, won }) => (
                <li key={ticket.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400">
                      {GAMES[ticket.game]?.label} · {ticket.drawDate}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {ticket.numbers.map((n) => (
                        <Ball key={n} number={n} game={ticket.game} size="sm" matched={ev.matchedWhite.includes(n)} />
                      ))}
                      <Ball number={ticket.specialNumber} game={ticket.game} size="sm" isSpecial matched={ev.specialMatched} />
                    </div>
                  </div>
                  <div className="font-bold text-slate-100 whitespace-nowrap">
                    {ev.prize.isJackpot ? 'JACKPOT' : formatCents(won)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Prize tiers hit</h4>
          <div className="space-y-3">
            {GAME_KEYS.map((g) => {
              const rows = [...tiers[g].values()].sort(
                (a, b) => b.white - a.white || Number(b.special) - Number(a.special)
              );
              return (
                <div key={g}>
                  <div className="text-xs text-slate-400 mb-1">{GAMES[g].label}</div>
                  {rows.length === 0 ? (
                    <div className="text-sm text-slate-500">None yet</div>
                  ) : (
                    <table className="w-full text-sm tabular-nums">
                      <tbody>
                        {rows.map((r) => (
                          <tr key={`${r.white}_${r.special}`}>
                            <td className="py-0.5">
                              {r.white} number{r.white === 1 ? '' : 's'}
                              {r.special ? ` + ${GAMES[g].specialLabel}` : ''}
                            </td>
                            <td className="text-right text-slate-300">{r.count}×</td>
                            <td className="text-right w-24">{formatCents(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString(undefined, { month: 'short' }) + ` '${String(y).slice(2)}`;
}

// Bar path with only the top two corners rounded.
function barPath(x, y, w, h, r) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function niceMax(v) {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * mag >= v) return step * mag;
  }
  return 10 * mag;
}

function useWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || fallback));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width];
}

function MonthlyChart({ months }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [boxRef, boxWidth] = useWidth(640);

  if (months.length === 0) return null;

  // Draw at the container's real pixel width so labels stay 11px on phones.
  const W = Math.max(280, Math.round(boxWidth));
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 28, left: 52 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxVal = niceMax(Math.max(...months.map((m) => Math.max(m.spent, m.won))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxVal);
  const slot = innerW / months.length;
  const barW = Math.min(18, Math.max(3, (slot - 8) / 2));
  const y = (v) => pad.top + innerH - (v / maxVal) * innerH;
  const labelEvery = Math.ceil(months.length / Math.max(2, Math.floor(innerW / 64)));
  const hovered = hover != null ? months[hover] : null;

  return (
    <div className="bg-slate-800 rounded-xl p-4" ref={boxRef}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-300">Spent vs. won by month</h4>
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: SPENT_COLOR }} /> Spent
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: WON_COLOR }} /> Won
          </span>
          <button onClick={() => setShowTable((s) => !s)} className="underline text-slate-400 hover:text-white">
            {showTable ? 'Show chart' : 'Show table'}
          </button>
        </div>
      </div>

      {showTable ? (
        <table className="w-full text-sm tabular-nums">
          <thead className="text-slate-400 text-xs uppercase">
            <tr>
              <th className="text-left font-medium py-1">Month</th>
              <th className="text-right font-medium">Spent</th>
              <th className="text-right font-medium">Won</th>
              <th className="text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t border-slate-700">
                <td className="py-1">{monthLabel(m.month)}</td>
                <td className="text-right">{formatCents(m.spent)}</td>
                <td className="text-right">{formatCents(m.won)}</td>
                <td className="text-right">{formatCents(m.won - m.spent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#475569' : '#334155'} strokeWidth="1" />
                <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                  ${Math.round(t / 100).toLocaleString()}
                </text>
              </g>
            ))}
            {months.map((m, i) => {
              const cx = pad.left + slot * i + slot / 2;
              const sx = cx - barW - 1;
              const wx = cx + 1;
              return (
                <g key={m.month}>
                  {hover === i && (
                    <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} fill="#ffffff" opacity="0.04" />
                  )}
                  <path d={barPath(sx, y(m.spent), barW, y(0) - y(m.spent), 4)} fill={SPENT_COLOR} />
                  <path d={barPath(wx, y(m.won), barW, y(0) - y(m.won), 4)} fill={WON_COLOR} />
                  {i % labelEvery === 0 && (
                    <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">
                      {monthLabel(m.month)}
                    </text>
                  )}
                  <rect
                    x={pad.left + slot * i}
                    y={pad.top}
                    width={slot}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>
          {hovered && (
            <div
              className="absolute top-0 pointer-events-none bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs shadow-lg"
              style={{
                left: `${((pad.left + slot * hover + slot / 2) / W) * 100}%`,
                transform: hover > months.length / 2 ? 'translateX(-105%)' : 'translateX(5%)',
              }}
            >
              <div className="font-semibold text-slate-100">{monthLabel(hovered.month)}</div>
              <div className="text-slate-300">Spent {formatCents(hovered.spent)}</div>
              <div className="text-slate-300">Won {formatCents(hovered.won)}</div>
              <div className="text-slate-400">Net {formatCents(hovered.won - hovered.spent)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Heatmaps ─────────────────────────────────────────────────────────────────

function HeatmapSection({ game, freq }) {
  const [view, setView] = useState('drawn');
  const cfg = GAMES[game];
  const drawn = view === 'drawn';
  const first = freq.draws[freq.draws.length - 1]?.drawDate;
  const last = freq.draws[0]?.drawDate;

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
          {[
            ['drawn', 'Drawn'],
            ['played', 'Our picks'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`text-sm px-3 py-1 rounded ${
                view === k ? 'bg-slate-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-400">
          {drawn
            ? freq.draws.length
              ? `Based on ${freq.draws.length} draws (${first} to ${last})`
              : 'No draws stored yet'
            : `Based on ${freq.playedCount} ticket${freq.playedCount === 1 ? '' : 's'} we played`}
        </div>
      </div>

      <div className="grid md:grid-cols-[2fr_1fr] gap-6">
        <Heatmap
          key={`${game}-${view}-w`}
          title="Main numbers"
          max={freq.whiteMax}
          stats={drawn ? freq.drawnWhite : freq.playedWhite}
          verb={drawn ? 'drawn' : 'played'}
        />
        <Heatmap
          key={`${game}-${view}-s`}
          title={cfg.specialLabel}
          max={freq.specialMax}
          stats={drawn ? freq.drawnSpecial : freq.playedSpecial}
          verb={drawn ? 'drawn' : 'played'}
        />
      </div>
    </div>
  );
}

function PredictionBox({ game, freq }) {
  const [mode, setMode] = useState('hot');
  const [pick, setPick] = useState(() => makePick(freq, 'hot', false));

  useEffect(() => {
    setPick(makePick(freq, mode, false));
  }, [freq, mode]);

  const hasData = freq.draws.length > 0;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-dashed border-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="text-sm font-semibold text-slate-300">"Prediction" for {GAMES[game].label}</h4>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
            {[
              ['hot', 'Hot'],
              ['cold', 'Cold'],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`text-sm px-3 py-1 rounded ${
                  mode === k ? 'bg-slate-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPick(makePick(freq, mode, true))}
            disabled={!hasData}
            className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1 rounded"
          >
            Re-roll
          </button>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="flex gap-2 flex-wrap">
            {pick.whites.map((n) => (
              <Ball key={n} number={n} game={game} />
            ))}
            {pick.special != null && <Ball number={pick.special} game={game} isSpecial />}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {mode === 'hot'
              ? 'Hot: the numbers drawn most often in our stored results.'
              : 'Cold: the numbers that have gone longest without being drawn.'}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-400">No draws stored yet.</p>
      )}

      <p className="text-xs text-yellow-400/90 mt-3">
        Just for fun. Past draws don't affect future ones, so this doesn't change your odds.
      </p>
    </div>
  );
}
