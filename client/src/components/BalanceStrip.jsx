import { Link } from 'react-router-dom';
import { formatCents } from '../format.js';

export default function BalanceStrip({ people }) {
  if (!people || people.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Balances</h2>
        <Link
          to="/balances"
          className="text-xs text-slate-400 hover:text-yellow-400"
        >
          View ledger →
        </Link>
      </div>
      <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
        {people.map((p) => {
          const c = p.balanceCents || 0;
          const color =
            c > 0
              ? 'text-green-400'
              : c < 0
              ? 'text-red-400'
              : 'text-slate-300';
          return (
            <div
              key={p.id}
              className={`bg-slate-800 border border-slate-700 rounded-lg p-3 ${
                p.active === false ? 'opacity-60' : ''
              }`}
            >
              <div className="text-xs text-slate-400 truncate">
                {p.name}
                {p.active === false && (
                  <span className="ml-1 text-slate-500">(inactive)</span>
                )}
              </div>
              <div className={`text-lg font-bold ${color}`}>
                {formatCents(c)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
