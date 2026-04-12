import { useEffect, useState } from 'react';
import {
  getTickets,
  addTicket,
  deleteTicket,
  checkAuth,
  refreshResults,
} from '../api.js';
import Ball from '../components/Ball.jsx';
import TicketCard from '../components/TicketCard.jsx';

const GAME_CONFIG = {
  megaMillions: {
    label: 'Mega Millions',
    whiteCount: 5,
    whiteMax: 70,
    specialLabel: 'Mega Ball',
    specialMax: 25,
    multiplierLabel: 'Megaplier',
    multiplierOptions: [2, 3, 4, 5],
  },
  powerball: {
    label: 'Powerball',
    whiteCount: 5,
    whiteMax: 69,
    specialLabel: 'Powerball',
    specialMax: 26,
    multiplierLabel: 'Power Play',
    multiplierOptions: [2, 3, 4, 5, 10],
  },
  superLotto: {
    label: 'Super Lotto Plus',
    whiteCount: 5,
    whiteMax: 47,
    specialLabel: 'Mega Number',
    specialMax: 27,
    multiplierLabel: null,
    multiplierOptions: [],
  },
};

const emptyWhites = (n) => Array(n).fill('');

export default function Admin() {
  const [password, setPassword] = useState(
    () => localStorage.getItem('adminPw') || ''
  );
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [tickets, setTickets] = useState([]);

  const [game, setGame] = useState('megaMillions');
  const [drawDate, setDrawDate] = useState('');
  const [whites, setWhites] = useState(emptyWhites(5));
  const [special, setSpecial] = useState('');
  const [useMultiplier, setUseMultiplier] = useState(false);
  const [multiplier, setMultiplier] = useState('');
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  const cfg = GAME_CONFIG[game];

  useEffect(() => {
    if (password) tryLogin(password);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authed) getTickets().then(setTickets).catch(() => {});
  }, [authed]);

  useEffect(() => {
    setWhites(emptyWhites(cfg.whiteCount));
    setSpecial('');
    setUseMultiplier(false);
    setMultiplier('');
  }, [game, cfg.whiteCount]);

  async function tryLogin(pw) {
    const ok = await checkAuth(pw);
    if (ok) {
      setAuthed(true);
      setAuthError('');
      localStorage.setItem('adminPw', pw);
    } else {
      setAuthed(false);
      setAuthError('Invalid password');
      localStorage.removeItem('adminPw');
    }
  }

  function logout() {
    setAuthed(false);
    setPassword('');
    localStorage.removeItem('adminPw');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    const nums = whites.map((w) => Number(w)).filter((n) => n > 0);
    if (nums.length !== cfg.whiteCount) {
      return setFormError(`Need ${cfg.whiteCount} numbers`);
    }
    if (new Set(nums).size !== nums.length) {
      return setFormError('Numbers must be unique');
    }
    if (nums.some((n) => n < 1 || n > cfg.whiteMax)) {
      return setFormError(`Numbers must be 1–${cfg.whiteMax}`);
    }
    const sp = Number(special);
    if (!sp || sp < 1 || sp > cfg.specialMax) {
      return setFormError(`${cfg.specialLabel} must be 1–${cfg.specialMax}`);
    }
    if (!drawDate) return setFormError('Draw date required');

    setBusy(true);
    try {
      await addTicket(
        {
          game,
          drawDate,
          numbers: nums,
          specialNumber: sp,
          multiplier: useMultiplier && multiplier ? Number(multiplier) : null,
          label,
        },
        password
      );
      setWhites(emptyWhites(cfg.whiteCount));
      setSpecial('');
      setUseMultiplier(false);
      setMultiplier('');
      setLabel('');
      setFlash('Ticket added');
      setTimeout(() => setFlash(''), 2000);
      const t = await getTickets();
      setTickets(t);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this ticket?')) return;
    await deleteTicket(id, password);
    const t = await getTickets();
    setTickets(t);
  }

  async function handleRefresh() {
    setBusy(true);
    try {
      await refreshResults(password);
      setFlash('Results refreshed');
      setTimeout(() => setFlash(''), 2000);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-12 bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h2 className="text-xl font-bold mb-4">Admin Login</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            tryLogin(password);
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-slate-700 rounded px-3 py-2 mb-3 outline-none focus:ring-2 focus:ring-yellow-400"
          />
          {authError && (
            <div className="text-red-400 text-sm mb-3">{authError}</div>
          )}
          <button className="w-full bg-yellow-400 text-slate-900 font-bold py-2 rounded hover:bg-yellow-300">
            Login
          </button>
        </form>
      </div>
    );
  }

  const previewWhites = whites.map((w) => (w ? Number(w) : null));
  const previewSpecial = special ? Number(special) : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Admin</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={busy}
            className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1 rounded"
          >
            Refresh Results
          </button>
          <button
            onClick={logout}
            className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      {flash && (
        <div className="bg-green-700 text-white px-4 py-2 rounded">{flash}</div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 border border-slate-700 p-4 rounded-lg space-y-4"
      >
        <h3 className="font-bold text-lg">Add Ticket</h3>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-400">Game</span>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-full bg-slate-700 rounded px-3 py-2 mt-1"
            >
              <option value="megaMillions">Mega Millions</option>
              <option value="powerball">Powerball</option>
              <option value="superLotto">Super Lotto Plus</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Draw Date</span>
            <input
              type="date"
              value={drawDate}
              onChange={(e) => setDrawDate(e.target.value)}
              className="w-full bg-slate-700 rounded px-3 py-2 mt-1"
            />
          </label>
        </div>

        <div>
          <span className="text-sm text-slate-400">
            Numbers (1–{cfg.whiteMax})
          </span>
          <div className="flex gap-2 mt-1 flex-wrap">
            {whites.map((w, i) => (
              <input
                key={i}
                type="number"
                min="1"
                max={cfg.whiteMax}
                value={w}
                onChange={(e) => {
                  const next = [...whites];
                  next[i] = e.target.value;
                  setWhites(next);
                }}
                className="w-16 bg-slate-700 rounded px-2 py-2 text-center"
              />
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm text-slate-400">
            {cfg.specialLabel} (1–{cfg.specialMax})
          </span>
          <input
            type="number"
            min="1"
            max={cfg.specialMax}
            value={special}
            onChange={(e) => setSpecial(e.target.value)}
            className="block w-20 bg-slate-700 rounded px-2 py-2 text-center mt-1"
          />
        </div>

        {cfg.multiplierLabel && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useMultiplier}
                onChange={(e) => setUseMultiplier(e.target.checked)}
              />
              <span className="text-sm">{cfg.multiplierLabel}</span>
            </label>
            {useMultiplier && (
              <select
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                className="bg-slate-700 rounded px-2 py-1"
              >
                <option value="">Select…</option>
                {cfg.multiplierOptions.map((m) => (
                  <option key={m} value={m}>
                    ×{m}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <label className="block">
          <span className="text-sm text-slate-400">Label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Dad's quick pick"
            className="w-full bg-slate-700 rounded px-3 py-2 mt-1"
          />
        </label>

        <div className="bg-slate-900 p-3 rounded border border-slate-700">
          <div className="text-xs text-slate-400 mb-2">Live Preview</div>
          <div className="flex gap-2 flex-wrap items-center">
            {previewWhites.map((n, i) =>
              n ? (
                <Ball key={i} number={n} game={game} size="sm" />
              ) : (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full border-2 border-dashed border-slate-600"
                />
              )
            )}
            <span className="text-slate-500 px-1">+</span>
            {previewSpecial ? (
              <Ball number={previewSpecial} game={game} isSpecial size="sm" />
            ) : (
              <div className="w-9 h-9 rounded-full border-2 border-dashed border-slate-600" />
            )}
          </div>
        </div>

        {formError && <div className="text-red-400 text-sm">{formError}</div>}
        <button
          type="submit"
          disabled={busy}
          className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold px-4 py-2 rounded disabled:opacity-50"
        >
          Add Ticket
        </button>
      </form>

      <section>
        <h3 className="font-bold mb-3">Existing Tickets ({tickets.length})</h3>
        {tickets.length === 0 ? (
          <div className="text-slate-400 text-center py-6 bg-slate-800/50 rounded">
            None yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tickets.map((t) => (
              <TicketCard key={t.id} ticket={t} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
