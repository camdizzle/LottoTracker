import { useEffect, useMemo, useState } from 'react';
import { getPeople, getTransactions } from '../api.js';
import { formatCents } from '../format.js';

const TYPE_LABELS = {
  deposit: 'Deposit',
  ticket: 'Ticket',
  payout: 'Payout',
  adjustment: 'Adjustment',
};

const TYPE_COLORS = {
  deposit: 'bg-green-800 text-green-200',
  ticket: 'bg-red-900 text-red-200',
  payout: 'bg-yellow-800 text-yellow-100',
  adjustment: 'bg-slate-700 text-slate-200',
};

export default function Balances() {
  const [people, setPeople] = useState([]);
  const [txns, setTxns] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPeople(), getTransactions()])
      .then(([p, t]) => {
        setPeople(p);
        setTxns(t);
      })
      .finally(() => setLoading(false));
  }, []);

  const personById = useMemo(() => {
    const m = {};
    for (const p of people) m[p.id] = p;
    return m;
  }, [people]);

  const filtered = useMemo(
    () => (filter ? txns.filter((t) => t.personId === filter) : txns),
    [filter, txns]
  );

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading…</div>;
  }

  const total = people.reduce((s, p) => s + (p.balanceCents || 0), 0);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Balances & Ledger</h2>

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
            <button
              key={p.id}
              onClick={() => setFilter(filter === p.id ? '' : p.id)}
              className={`text-left bg-slate-800 border rounded-lg p-3 transition ${
                filter === p.id
                  ? 'border-yellow-400'
                  : 'border-slate-700 hover:border-slate-500'
              } ${p.active === false ? 'opacity-60' : ''}`}
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
            </button>
          );
        })}
      </div>

      <div className="text-sm text-slate-400">
        Group total:{' '}
        <span className="text-slate-200 font-semibold">
          {formatCents(total)}
        </span>
        {filter && (
          <button
            onClick={() => setFilter('')}
            className="ml-4 text-yellow-400 hover:text-yellow-300"
          >
            Clear filter
          </button>
        )}
      </div>

      <section>
        <h3 className="font-bold mb-3">
          Transactions ({filtered.length})
        </h3>
        {filtered.length === 0 ? (
          <div className="text-slate-400 text-center py-8 bg-slate-800/50 rounded-lg">
            No transactions yet.
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-lg divide-y divide-slate-700">
            {filtered.map((t) => {
              const person = personById[t.personId];
              const positive = t.amount >= 0;
              return (
                <div
                  key={t.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${
                          TYPE_COLORS[t.type] || TYPE_COLORS.adjustment
                        }`}
                      >
                        {TYPE_LABELS[t.type] || t.type}
                      </span>
                      <span className="text-slate-200 truncate">
                        {person?.name || t.personId}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {t.description} · {t.createdAt.split('T')[0]}
                    </div>
                  </div>
                  <div
                    className={`font-bold ${
                      positive ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {positive ? '+' : ''}
                    {formatCents(t.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
