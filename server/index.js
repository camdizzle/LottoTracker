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

async function refreshResults() {
  const [mm, pb, sl] = await Promise.all([
    fetchMegaMillions().catch((e) => {
      console.warn('MM refresh failed:', e.message);
      return null;
    }),
    fetchPowerball().catch((e) => {
      console.warn('PB refresh failed:', e.message);
      return null;
    }),
    fetchSuperLotto().catch((e) => {
      console.warn('SL refresh failed:', e.message);
      return null;
    }),
  ]);
  const db = readDb();
  db.results = {
    megaMillions: mm ?? db.results?.megaMillions ?? [],
    powerball: pb ?? db.results?.powerball ?? [],
    superLotto: sl ?? db.results?.superLotto ?? [],
    lastFetched: Date.now(),
  };
  writeDb(db);
  return db.results;
}

async function getResultsCached() {
  const db = readDb();
  const last = db.results?.lastFetched || 0;
  if (Date.now() - last > CACHE_MS) {
    return await refreshResults();
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
    const results = await getResultsCached();
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ error: 'Invalid password' });
});

// --- Admin endpoints ---
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
  const ticket = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    game,
    drawDate,
    numbers: numbers.map(Number),
    specialNumber: Number(specialNumber),
    multiplier: multiplier ? Number(multiplier) : null,
    label: (label || '').toString().slice(0, 60),
    createdAt: new Date().toISOString(),
  };
  const db = readDb();
  db.tickets.push(ticket);
  writeDb(db);
  res.json(ticket);
});

app.delete('/api/tickets/:id', requireAuth, (req, res) => {
  const db = readDb();
  const before = db.tickets.length;
  db.tickets = db.tickets.filter((t) => t.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true, deleted: before - db.tickets.length });
});

app.post('/api/results/refresh', requireAuth, async (_req, res) => {
  try {
    const results = await refreshResults();
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Static client in production ---
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Client build not found. Run `npm run build`.');
  });
});

app.listen(PORT, () => {
  console.log(`🎰 Lotto Tracker server on http://localhost:${PORT}`);
  console.log(`   Admin password: ${ADMIN_PASSWORD === 'lotto123' ? '(default) lotto123' : '(from env)'}`);
});
