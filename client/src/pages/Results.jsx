import { useEffect, useState } from 'react';
import { getTickets, getResults, getPeople, getTransactions } from '../api.js';
import ResultCard from '../components/ResultCard.jsx';
import TicketCard from '../components/TicketCard.jsx';
import BalanceStrip from '../components/BalanceStrip.jsx';
import { evaluateTicket } from '../prizes.js';
import { formatCents } from '../format.js';

function findResultForTicket(results, ticket) {
  const list = results?.[ticket.game] || [];
  return list.find((r) => r.drawDate === ticket.drawDate) || null;
}

export default function Results() {
  const [tickets, setTickets] = useState([]);
  const [results, setResults] = useState(null);
  const [people, setPeople] = useState([]);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getTickets(), getResults(), getPeople(), getTransactions()])
      .then(([t, r, p, tx]) => {
        setTickets(t);
        setResults(r);
        setPeople(p);
        setTxns(tx);
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
  const lastFetched = results?.lastFetched;

  let totalWonDollars = 0;
  let hasJackpot = false;
  for (const t of tickets) {
    const r = findResultForTicket(results, t);
    const { prize } = evaluateTicket(t, r);
    if (prize.isJackpot) hasJackpot = true;
    totalWonDollars += prize.amount || 0;
  }
  const totalWonCents = Math.round(totalWonDollars * 100);

  let totalSpentCents = 0;
  for (const t of tickets) {
    totalSpentCents += t.costCents || 0;
  }

  let totalPaidOutCents = 0;
  for (const t of txns) {
    if (t.type === 'payout') totalPaidOutCents += t.amount;
  }

  const uncollectedCents = totalWonCents - totalPaidOutCents;

  return (
    <div className="space-y-6">
      {hasJackpot ? (
        <div className="rounded-xl p-5 text-center bg-yellow-400 text-slate-900 animate-pulse-yellow">
          <div className="text-3xl font-bold">🎉 JACKPOT! 🎉</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-4 text-center bg-slate-800">
            <div className="text-xs uppercase tracking-wider text-slate-400">
              Total Won
            </div>
            <div
              className={`text-2xl font-bold mt-1 ${
                totalWonCents > 0 ? 'text-green-400' : 'text-slate-300'
              }`}
            >
              {formatCents(totalWonCents)}
            </div>
          </div>
          <div className="rounded-xl p-4 text-center bg-slate-800">
            <div className="text-xs uppercase tracking-wider text-slate-400">
              Total Spent
            </div>
            <div className="text-2xl font-bold mt-1 text-red-400">
              {formatCents(totalSpentCents)}
            </div>
          </div>
          <div className="rounded-xl p-4 text-center bg-slate-800">
            <div className="text-xs uppercase tracking-wider text-slate-400">
              Uncollected
            </div>
            <div
              className={`text-2xl font-bold mt-1 ${
                uncollectedCents > 0 ? 'text-yellow-400' : 'text-slate-300'
              }`}
            >
              {formatCents(uncollectedCents)}
            </div>
          </div>
        </div>
      )}

      <BalanceStrip people={people} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Latest Drawings</h2>
          {lastFetched && (
            <span className="text-xs text-slate-500">
              Updated {new Date(lastFetched).toLocaleString()}
            </span>
          )}
        </div>
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
