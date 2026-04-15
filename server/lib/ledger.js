// Ledger helpers: pricing, even cent splitting, balance computation.
//
// Everything monetary is integer cents to avoid floating-point drift.

export const TICKET_PRICE_CENTS = {
  megaMillions: 500,
  powerball: 200,
  superLotto: 100,
};

// Split `totalCents` across the given person IDs as evenly as possible.
// Returns [{ personId, amount }] in cents. Any leftover pennies are given to
// people sorted by id (deterministic) so the split is reproducible.
export function splitCents(totalCents, personIds) {
  const n = personIds.length;
  if (n === 0) return [];
  const base = Math.trunc(totalCents / n);
  const remainder = totalCents - base * n;
  const sorted = [...personIds].sort();
  return sorted.map((id, i) => ({
    personId: id,
    amount: base + (i < remainder ? 1 : 0),
  }));
}

// Sum each person's transactions. Returns { [personId]: cents }.
export function computeBalances(db) {
  const balances = {};
  for (const p of db.people || []) balances[p.id] = 0;
  for (const t of db.transactions || []) {
    balances[t.personId] = (balances[t.personId] || 0) + (t.amount || 0);
  }
  return balances;
}

export function activePeopleIds(db) {
  return (db.people || [])
    .filter((p) => p.active !== false)
    .map((p) => p.id);
}

let counter = 0;
export function makeId(prefix = 'tx') {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}
