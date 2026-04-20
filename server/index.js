import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { readDb, writeDb } from './db.js';
import {
  fetchMegaMillions,
  fetchPowerball,
  fetchSuperLotto,
} from './services/lottoApi.js';
import {
  TICKET_PRICE_CENTS,
  splitCents,
  computeBalances,
  activePeopleIds,
  makeId,
} from './lib/ledger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lotto123';
const CACHE_MS = 4 * 60 * 60 * 1000; // 4 hours

const app = express();
app.use(cors());
app.use(express.json());

function requireAuth(req, res, next) {
  const pw = req.headers['x-admin-password'];
  if (pw !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Merge fetched results with existing ones so manual entries are never lost.
// Fetched data wins for the same drawDate; manual entries for dates not in
// the fetched set are preserved. Keeps the 60 most recent draws.
function mergeDrawResults(existing, fetched) {
  if (!fetched?.length) return existing || [];
  const byDate = new Map();
  for (const r of existing || []) byDate.set(r.drawDate, r);
  for (const r of fetched) byDate.set(r.drawDate, r);
  return [...byDate.values()]
    .sort((a, b) => b.drawDate.localeCompare(a.drawDate))
    .slice(0, 60);
}

async function refreshResults() {
  const status = { megaMillions: 'ok', powerball: 'ok', superLotto: 'ok' };
  const [mm, pb, sl] = await Promise.all([
    fetchMegaMillions().catch((e) => {
      console.warn('MM refresh failed:', e.message);
      status.megaMillions = e.message;
      return null;
    }),
    fetchPowerball().catch((e) => {
      console.warn('PB refresh failed:', e.message);
      status.powerball = e.message;
      return null;
    }),
    fetchSuperLotto().catch((e) => {
      console.warn('SL refresh failed:', e.message);
      status.superLotto = e.message;
      return null;
    }),
  ]);
  const db = readDb();
  const prev = db.results || {};
  db.results = {
    megaMillions: mergeDrawResults(prev.megaMillions, mm),
    powerball: mergeDrawResults(prev.powerball, pb),
    superLotto: mergeDrawResults(prev.superLotto, sl),
    lastFetched: Date.now(),
  };
  writeDb(db);
  if (sl && sl.length === 0 && status.superLotto === 'ok') {
    status.superLotto = 'ok (no draws returned)';
  }
  return { results: db.results, status };
}

async function getResultsCached() {
  const db = readDb();
  const last = db.results?.lastFetched || 0;
  if (Date.now() - last > CACHE_MS) {
    const { results } = await refreshResults();
    return results;
  }
  return db.results;
}

// --- Public endpoints ---
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/tickets', (_req, res) => {
  const db = readDb();
  const tickets = [...db.tickets].sort((a, b) =>
    (b.drawDate || '').localeCompare(a.drawDate || '')
  );
  res.json(tickets);
});

app.get('/api/results', async (_req, res) => {
  try {
    const cached = await getResultsCached();
    // getResultsCached returns either { results, status } or the raw db.results
    const results = cached.results || cached;
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/pricing', (_req, res) => {
  res.json(TICKET_PRICE_CENTS);
});

app.get('/api/people', (_req, res) => {
  const db = readDb();
  const balances = computeBalances(db);
  const people = [...db.people]
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .map((p) => ({ ...p, balanceCents: balances[p.id] || 0 }));
  res.json(people);
});

app.get('/api/transactions', (req, res) => {
  const db = readDb();
  const { personId, ticketId } = req.query;
  let txns = [...db.transactions];
  if (personId) txns = txns.filter((t) => t.personId === personId);
  if (ticketId) txns = txns.filter((t) => t.ticketId === ticketId);
  txns.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(txns);
});

app.post('/api/auth', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ error: 'Invalid password' });
});

// --- Admin endpoints ---

// Tickets
app.post('/api/tickets', requireAuth, (req, res) => {
  const { game, drawDate, numbers, specialNumber, multiplier, label } =
    req.body || {};
  if (!['megaMillions', 'powerball', 'superLotto'].includes(game)) {
    return res.status(400).json({ error: 'Invalid game' });
  }
  if (!drawDate || !Array.isArray(numbers) || numbers.length !== 5) {
    return res.status(400).json({ error: 'Need drawDate and 5 numbers' });
  }
  if (specialNumber == null) {
    return res.status(400).json({ error: 'Need special number' });
  }
  const db = readDb();
  const costCents = TICKET_PRICE_CENTS[game];
  const ticket = {
    id: makeId('tkt'),
    game,
    drawDate,
    numbers: numbers.map(Number),
    specialNumber: Number(specialNumber),
    multiplier: multiplier ? Number(multiplier) : null,
    label: (label || '').toString().slice(0, 60),
    costCents,
    createdAt: new Date().toISOString(),
  };
  db.tickets.push(ticket);

  // Split the cost across active people as deductions.
  const activeIds = activePeopleIds(db);
  if (activeIds.length > 0) {
    const splits = splitCents(costCents, activeIds);
    const createdAt = new Date().toISOString();
    for (const s of splits) {
      db.transactions.push({
        id: makeId('tx'),
        personId: s.personId,
        amount: -s.amount, // debit
        type: 'ticket',
        description: `${game} ticket ${drawDate}${label ? ` — ${label}` : ''}`,
        ticketId: ticket.id,
        createdAt,
      });
    }
  } else {
    console.warn('No active people; ticket created without deductions.');
  }

  writeDb(db);
  res.json(ticket);
});

app.delete('/api/tickets/:id', requireAuth, (req, res) => {
  const db = readDb();
  const before = db.tickets.length;
  db.tickets = db.tickets.filter((t) => t.id !== req.params.id);
  // Refund any deductions linked to this ticket.
  db.transactions = db.transactions.filter(
    (t) => t.ticketId !== req.params.id
  );
  writeDb(db);
  res.json({ ok: true, deleted: before - db.tickets.length });
});

app.post('/api/results/refresh', requireAuth, async (_req, res) => {
  try {
    const { results, status } = await refreshResults();
    res.json({ ...results, _fetchStatus: status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Manual result entry — lets admins type in winning numbers when APIs are down.
app.post('/api/results/manual', requireAuth, (req, res) => {
  const { game, drawDate, whiteNumbers, specialNumber, multiplier } =
    req.body || {};
  if (!['megaMillions', 'powerball', 'superLotto'].includes(game)) {
    return res.status(400).json({ error: 'Invalid game' });
  }
  if (!drawDate) {
    return res.status(400).json({ error: 'drawDate required' });
  }
  if (!Array.isArray(whiteNumbers) || whiteNumbers.length !== 5) {
    return res.status(400).json({ error: 'Need exactly 5 white numbers' });
  }
  if (specialNumber == null) {
    return res.status(400).json({ error: 'specialNumber required' });
  }

  const entry = {
    drawDate,
    whiteNumbers: whiteNumbers.map(Number),
    multiplier: multiplier ? Number(multiplier) : null,
  };

  // Set the game-specific special ball field.
  if (game === 'megaMillions') entry.megaBall = Number(specialNumber);
  else if (game === 'powerball') entry.powerball = Number(specialNumber);
  else entry.megaNumber = Number(specialNumber);

  const db = readDb();
  if (!db.results) {
    db.results = { megaMillions: [], powerball: [], superLotto: [] };
  }
  if (!db.results[game]) db.results[game] = [];

  // Replace if same drawDate exists, otherwise prepend.
  const idx = db.results[game].findIndex((r) => r.drawDate === drawDate);
  if (idx >= 0) {
    db.results[game][idx] = entry;
  } else {
    db.results[game].unshift(entry);
    // Keep sorted by drawDate descending.
    db.results[game].sort((a, b) => b.drawDate.localeCompare(a.drawDate));
  }
  writeDb(db);
  res.json({ ok: true, entry });
});

// People
app.post('/api/people', requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name required' });
  }
  const db = readDb();
  const person = {
    id: makeId('p'),
    name: name.trim().slice(0, 40),
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.people.push(person);
  writeDb(db);
  res.json(person);
});

app.patch('/api/people/:id', requireAuth, (req, res) => {
  const { name, active } = req.body || {};
  const db = readDb();
  const person = db.people.find((p) => p.id === req.params.id);
  if (!person) return res.status(404).json({ error: 'Not found' });
  if (typeof name === 'string' && name.trim()) {
    person.name = name.trim().slice(0, 40);
  }
  if (typeof active === 'boolean') {
    person.active = active;
  }
  writeDb(db);
  res.json(person);
});

app.delete('/api/people/:id', requireAuth, (req, res) => {
  const db = readDb();
  const hasTx = db.transactions.some((t) => t.personId === req.params.id);
  if (hasTx) {
    return res.status(400).json({
      error:
        'Person has transactions. Set active=false instead to stop future deductions.',
    });
  }
  const before = db.people.length;
  db.people = db.people.filter((p) => p.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true, deleted: before - db.people.length });
});

// Transactions: deposits, payouts, adjustments
app.post('/api/transactions/deposit', requireAuth, (req, res) => {
  const { personId, amountCents, description } = req.body || {};
  const amt = Math.round(Number(amountCents));
  if (!personId || !Number.isFinite(amt) || amt <= 0) {
    return res
      .status(400)
      .json({ error: 'personId and positive amountCents required' });
  }
  const db = readDb();
  if (!db.people.find((p) => p.id === personId)) {
    return res.status(404).json({ error: 'Person not found' });
  }
  const txn = {
    id: makeId('tx'),
    personId,
    amount: amt, // credit
    type: 'deposit',
    description: (description || 'Venmo deposit').toString().slice(0, 80),
    ticketId: null,
    createdAt: new Date().toISOString(),
  };
  db.transactions.push(txn);
  writeDb(db);
  res.json(txn);
});

app.post('/api/transactions/payout', requireAuth, (req, res) => {
  const { amountCents, description } = req.body || {};
  const amt = Math.round(Number(amountCents));
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Positive amountCents required' });
  }
  const db = readDb();
  const activeIds = activePeopleIds(db);
  if (activeIds.length === 0) {
    return res.status(400).json({ error: 'No active people to pay out' });
  }
  const splits = splitCents(amt, activeIds);
  const createdAt = new Date().toISOString();
  const desc = (description || 'Winnings payout').toString().slice(0, 80);
  const created = splits.map((s) => {
    const txn = {
      id: makeId('tx'),
      personId: s.personId,
      amount: s.amount, // credit
      type: 'payout',
      description: desc,
      ticketId: null,
      createdAt,
    };
    db.transactions.push(txn);
    return txn;
  });
  writeDb(db);
  res.json({ created });
});

app.post('/api/transactions/adjustment', requireAuth, (req, res) => {
  const { personId, amountCents, description } = req.body || {};
  const amt = Math.round(Number(amountCents));
  if (!personId || !Number.isFinite(amt) || amt === 0) {
    return res
      .status(400)
      .json({ error: 'personId and non-zero amountCents required' });
  }
  const db = readDb();
  if (!db.people.find((p) => p.id === personId)) {
    return res.status(404).json({ error: 'Person not found' });
  }
  const txn = {
    id: makeId('tx'),
    personId,
    amount: amt,
    type: 'adjustment',
    description: (description || 'Manual adjustment').toString().slice(0, 80),
    ticketId: null,
    createdAt: new Date().toISOString(),
  };
  db.transactions.push(txn);
  writeDb(db);
  res.json(txn);
});

app.delete('/api/transactions/:id', requireAuth, (req, res) => {
  const db = readDb();
  const txn = db.transactions.find((t) => t.id === req.params.id);
  if (!txn) return res.status(404).json({ error: 'Not found' });
  if (txn.type === 'ticket') {
    return res.status(400).json({
      error: 'Ticket deductions are tied to a ticket — delete the ticket instead.',
    });
  }
  db.transactions = db.transactions.filter((t) => t.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

// --- Static client in production ---
// Built client files live at the repo root (index.html + assets/).
const rootDir = path.join(__dirname, '..');
app.use('/assets', express.static(path.join(rootDir, 'assets')));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'), (err) => {
    if (err) res.status(404).send('Client build not found. Run `npm run build`.');
  });
});

app.listen(PORT, () => {
  console.log(`🎰 Lotto Tracker server on http://localhost:${PORT}`);
  console.log(`   Admin password: ${ADMIN_PASSWORD === 'lotto123' ? '(default) lotto123' : '(from env)'}`);
});
