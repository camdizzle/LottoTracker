import { useEffect, useState } from 'react';
import { getTickets, getResults } from '../api.js';
import ResultCard from '../components/ResultCard.jsx';
import TicketCard from '../components/TicketCard.jsx';

const GAMES = ['megaMillions', 'powerball', 'superLotto'];

export default function History() {
  const [tickets, setTickets] = useState([]);
  const [results, setResults] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getTickets(), getResults()])
      .then(([t, r]) => {
        setTickets(t);
        setResults(r);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-slate-400">Loading…</div>;
  if (!results) return <div className="text-center py-12 text-red-400">No results loaded.</div>;

  // Collect every drawing date from results + tickets.
  const byDate = {};
  GAMES.forEach((game) => {
    (results[game] || []).forEach((r) => {
      if (!r.drawDate) return;
      if (!byDate[r.drawDate]) byDate[r.drawDate] = {};
      byDate[r.drawDate][game] = r;
    });
  });
  tickets.forEach((t) => {
    if (!byDate[t.drawDate]) byDate[t.drawDate] = {};
  });

  const dates = Object.keys(byDate).sort().reverse();

  const toggle = (d) => {
    const next = new Set(expanded);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setExpanded(next);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-3">History</h2>
      {dates.length === 0 && (
        <div className="text-slate-400 text-center py-8 bg-slate-800/50 rounded-lg">
          No drawings available yet.
        </div>
      )}
      {dates.map((date) => {
        const dayTickets = tickets.filter((t) => t.drawDate === date);
        const isOpen = expanded.has(date);
        return (
          <div
            key={date}
            className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700"
          >
            <button
              onClick={() => toggle(date)}
              className="w-full px-4 py-3 flex justify-between items-center hover:bg-slate-700 text-left"
            >
              <span className="font-semibold">{date}</span>
              <span className="text-sm text-slate-400">
                {dayTickets.length} ticket{dayTickets.length !== 1 ? 's' : ''} {isOpen ? '▲' : '▼'}
              </span>
            </button>
            {isOpen && (
              <div className="p-4 space-y-4 border-t border-slate-700">
                <div className="grid gap-3 md:grid-cols-3">
                  {GAMES.map(
                    (g) =>
                      byDate[date][g] && (
                        <ResultCard key={g} game={g} result={byDate[date][g]} />
                      )
                  )}
                </div>
                {dayTickets.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {dayTickets.map((t) => (
                      <TicketCard
                        key={t.id}
                        ticket={t}
                        result={byDate[date][t.game] || null}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
