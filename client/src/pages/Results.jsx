import { useEffect, useState } from 'react';
import { getTickets, getResults } from '../api.js';
import ResultCard from '../components/ResultCard.jsx';
import TicketCard from '../components/TicketCard.jsx';
import { evaluateTicket } from '../prizes.js';

function findResultForTicket(results, ticket) {
  const list = results?.[ticket.game] || [];
  return list.find((r) => r.drawDate === ticket.drawDate) || null;
}

export default function Results() {
  const [tickets, setTickets] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getTickets(), getResults()])
      .then(([t, r]) => {
        setTickets(t);
        setResults(r);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-slate-400">Loading…</div>;
  if (error) return <div className="text-center py-12 text-red-400">{error}</div>;

  const latest = {
    megaMillions: results?.megaMillions?.[0] || null,
    powerball: results?.powerball?.[0] || null,
    superLotto: results?.superLotto?.[0] || null,
  };

  let totalWinnings = 0;
  let hasJackpot = false;
  for (const t of tickets) {
    const r = findResultForTicket(results, t);
    const { prize } = evaluateTicket(t, r);
    if (prize.isJackpot) hasJackpot = true;
    totalWinnings += prize.amount || 0;
  }

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl p-5 text-center ${
          hasJackpot
            ? 'bg-yellow-400 text-slate-900 animate-pulse-yellow'
            : totalWinnings > 0
            ? 'bg-green-700'
            : 'bg-slate-800'
        }`}
      >
        <div className="text-xs uppercase tracking-wider opacity-80">Total Winnings</div>
        <div className="text-3xl font-bold mt-1">
          {hasJackpot
            ? '🎉 JACKPOT! 🎉'
            : `$${totalWinnings.toLocaleString()}`}
        </div>
      </div>

      <section>
        <h2 className="text-xl font-bold mb-3">Latest Drawings</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <ResultCard game="megaMillions" result={latest.megaMillions} />
          <ResultCard game="powerball" result={latest.powerball} />
          <ResultCard game="superLotto" result={latest.superLotto} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-3">Our Tickets</h2>
        {tickets.length === 0 ? (
          <div className="text-slate-400 text-center py-8 bg-slate-800/50 rounded-lg">
            No tickets yet — add some on the Admin page.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tickets.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                result={findResultForTicket(results, t)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
