import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function seedPeople() {
  const now = new Date().toISOString();
  return Array.from({ length: 5 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    active: true,
    createdAt: now,
  }));
}

const DEFAULT_DB = {
  tickets: [],
  people: seedPeople(),
  transactions: [],
  results: {
    megaMillions: [],
    powerball: [],
    superLotto: [],
    lastFetched: 0,
  },
};

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

export function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    // Fill in any new top-level fields that older DBs may be missing.
    const merged = { ...DEFAULT_DB, ...parsed };
    if (!Array.isArray(merged.people) || merged.people.length === 0) {
      merged.people = seedPeople();
    }
    if (!Array.isArray(merged.transactions)) {
      merged.transactions = [];
    }
    return merged;
  } catch (e) {
    console.error('readDb failed, resetting:', e);
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return { ...DEFAULT_DB };
  }
}

export function writeDb(data) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
