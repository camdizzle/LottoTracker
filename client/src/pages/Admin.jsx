import { useEffect, useState } from 'react';
import {
  getTickets,
  addTicket,
  deleteTicket,
  checkAuth,
  refreshResults,
  getPeople,
  getPricing,
  addPerson,
  updatePerson,
  deletePerson,
  addDeposit,
  addPayout,
} from '../api.js';
import Ball from '../components/Ball.jsx';
import TicketCard from '../components/TicketCard.jsx';
import { formatCents, parseDollarsToCents } from '../format.js';

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
  const [people, setPeople] = useState([]);
  const [pricing, setPricing] = useState({});

  // Ticket form
  const [game, setGame] = useState('megaMillions');
  const [drawDate, setDrawDate] = useState('');
  const [whites, setWhites] = useState(emptyWhites(5));
  const [special, setSpecial] = useState('');
  const [useMultiplier, setUseMultiplier] = useState(false);
  const [multiplier, setMultiplier] = useState('');
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState('');

  // Deposit form
  const [depositPersonId, setDepositPersonId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [depositError, setDepositError] = useState('');

  // Payout form
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutError, setPayoutError] = useState('');

  // New person form
  const [newPersonName, setNewPersonName] = useState('');

  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  const cfg = GAME_CONFIG[game];
  const activePeople = people.filter((p) => p.active !== false);
  const activeCount = activePeople.length;
  const ticketCost = pricing[game] || 0;
  const perPersonCents =
    activeCount > 0 ? Math.floor(ticketCost / activeCount) : 0;
  const perPersonRemainder =
    activeCount > 0 ? ticketCost - perPersonCents * activeCount : 0;

  useEffect(() => {
    if (password) tryLogin(password);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authed) reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    setWhites(emptyWhites(cfg.whiteCount));
    setSpecial('');
    setUseMultiplier(false);
    setMultiplier('');
  }, [game, cfg.whiteCount]);

  async function reloadAll() {
    try {
      const [t, p, pr] = await Promise.all([
        getTickets(),
        getPeople(),
        getPricing(),
      ]);
      setTickets(t);
      setPeople(p);
      setPricing(pr);
    } catch (e) {
      /* ignore */
    }
  }

  function showFlash(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  }

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

  async function handleTicketSubmit(e) {
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
      showFlash('Ticket added and split across active people');
      await reloadAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTicketDelete(id) {
    if (!confirm('Delete this ticket? Its deductions will be refunded.')) return;
    await deleteTicket(id, password);
    showFlash('Ticket deleted and deductions refunded');
    await reloadAll();
  }

  async function handleRefresh() {
    setBusy(true);
    try {
      await refreshResults(password);
      showFlash('Results refreshed');
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeposit(e) {
    e.preventDefault();
    setDepositError('');
    if (!depositPersonId) return setDepositError('Pick a person');
    const cents = parseDollarsToCents(depositAmount);
    if (!Number.isFinite(cents) || cents <= 0) {
      return setDepositError('Enter a positive dollar amount');
    }
    try {
      await addDeposit(
        {
          personId: depositPersonId,
          amountCents: cents,
          description: depositNote,
        },
        password
      );
      setDepositAmount('');
      setDepositNote('');
      showFlash('Deposit recorded');
      await reloadAll();
    } catch (err) {
      setDepositError(err.message);
    }
  }

  async function handlePayout(e) {
    e.preventDefault();
    setPayoutError('');
    const cents = parseDollarsToCents(payoutAmount);
    if (!Number.isFinite(cents) || cents <= 0) {
      return setPayoutError('Enter a positive dollar amount');
    }
    try {
      await addPayout(
        { amountCents: cents, description: payoutNote },
        password
      );
      setPayoutAmount('');
      setPayoutNote('');
      showFlash('Payout split across active people');
      await reloadAll();
    } catch (err) {
      setPayoutError(err.message);
    }
  }

  async function handleAddPerson(e) {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    try {
      await addPerson(newPersonName, password);
      setNewPersonName('');
      showFlash('Person added');
      await reloadAll();
    } catch (err) {
      showFlash(`Error: ${err.message}`);
    }
  }

  async function handleRenamePerson(id, name) {
    const current = people.find((p) => p.id === id)?.name || '';
    const next = prompt('New name:', current);
    if (!next || next === current) return;
    await updatePerson(id, { name: next }, password);
    await reloadAll();
  }

  async function handleToggleActive(id, active) {
    await updatePerson(id, { active }, password);
    await reloadAll();
  }

  async function handleDeletePerson(id) {
    if (!confirm('Remove this person? Only works if they have no transactions.')) {
      return;
    }
    try {
      await deletePerson(id, password);
      showFlash('Person removed');
      await reloadAll();
    } catch (err) {
      alert(err.message);
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
    <div className="space-y-8">
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

      {/* Ticket form */}
      <form
        onSubmit={handleTicketSubmit}
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
              <option value="megaMillions">Mega Millions ($5)</option>
              <option value="powerball">Powerball ($2)</option>
              <option value="superLotto">Super Lotto Plus ($1)</option>
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

        <div className="bg-slate-900 p-3 rounded border border-slate-700 text-sm">
          <div className="text-xs text-slate-400 mb-1">Cost split</div>
          {activeCount === 0 ? (
            <div className="text-red-400">
              No active people — ticket will be created without deductions.
            </div>
          ) : (
            <div>
              <span className="font-semibold">
                {formatCents(ticketCost)}
              </span>{' '}
              ticket ÷ <span className="font-semibold">{activeCount}</span>{' '}
              active people ={' '}
              <span className="text-red-400 font-semibold">
                {formatCents(perPersonCents)}
              </span>{' '}
              per person
              {perPersonRemainder > 0 && (
                <span className="text-slate-400 ml-1">
                  (+1¢ for first {perPersonRemainder})
                </span>
              )}
            </div>
          )}
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

      {/* Deposit form */}
      <form
        onSubmit={handleDeposit}
        className="bg-slate-800 border border-slate-700 p-4 rounded-lg space-y-3"
      >
        <h3 className="font-bold text-lg">Record Venmo Deposit</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm text-slate-400">Person</span>
            <select
              value={depositPersonId}
              onChange={(e) => setDepositPersonId(e.target.value)}
              className="w-full bg-slate-700 rounded px-3 py-2 mt-1"
            >
              <option value="">Select…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.active === false ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Amount ($)</span>
            <input
              type="text"
              inputMode="decimal"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="20.00"
              className="w-full bg-slate-700 rounded px-3 py-2 mt-1"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Note</span>
            <input
              type="text"
              value={depositNote}
              onChange={(e) => setDepositNote(e.target.value)}
              placeholder="Venmo 4/15"
              className="w-full bg-slate-700 rounded px-3 py-2 mt-1"
            />
          </label>
        </div>
        {depositError && (
          <div className="text-red-400 text-sm">{depositError}</div>
        )}
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-500 font-bold px-4 py-2 rounded"
        >
          Record Deposit
        </button>
      </form>

      {/* Payout form */}
      <form
        onSubmit={handlePayout}
        className="bg-slate-800 border border-slate-700 p-4 rounded-lg space-y-3"
      >
        <h3 className="font-bold text-lg">Record Winnings Payout</h3>
        <p className="text-xs text-slate-400">
          Splits the amount equally across all active people as credits.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-400">Total winnings ($)</span>
            <input
              type="text"
              inputMode="decimal"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              placeholder="100.00"
              className="w-full bg-slate-700 rounded px-3 py-2 mt-1"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Note</span>
            <input
              type="text"
              value={payoutNote}
              onChange={(e) => setPayoutNote(e.target.value)}
              placeholder="PB 4/12 payout"
              className="w-full bg-slate-700 rounded px-3 py-2 mt-1"
            />
          </label>
        </div>
        {payoutError && (
          <div className="text-red-400 text-sm">{payoutError}</div>
        )}
        <button
          type="submit"
          className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-4 py-2 rounded"
        >
          Split Payout
        </button>
      </form>

      {/* People */}
      <section className="bg-slate-800 border border-slate-700 p-4 rounded-lg space-y-3">
        <h3 className="font-bold text-lg">People</h3>
        <div className="space-y-2">
          {people.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between bg-slate-900 rounded px-3 py-2 ${
                p.active === false ? 'opacity-60' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  {p.name}
                  {p.active === false && (
                    <span className="ml-2 text-xs text-slate-500">
                      (inactive)
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  Balance: {formatCents(p.balanceCents || 0)}
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => handleRenamePerson(p.id)}
                  className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded"
                >
                  Rename
                </button>
                <button
                  onClick={() =>
                    handleToggleActive(p.id, p.active === false)
                  }
                  className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded"
                >
                  {p.active === false ? 'Activate' : 'Deactivate'}
                </button>
                <button
                  onClick={() => handleDeletePerson(p.id)}
                  className="bg-red-800 hover:bg-red-700 px-2 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddPerson} className="flex gap-2 pt-2">
          <input
            type="text"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder="New person name"
            className="flex-1 bg-slate-700 rounded px-3 py-2"
          />
          <button className="bg-yellow-400 text-slate-900 font-bold px-4 py-2 rounded hover:bg-yellow-300">
            Add
          </button>
        </form>
      </section>

      {/* Existing tickets */}
      <section>
        <h3 className="font-bold mb-3">Existing Tickets ({tickets.length})</h3>
        {tickets.length === 0 ? (
          <div className="text-slate-400 text-center py-6 bg-slate-800/50 rounded">
            None yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tickets.map((t) => (
              <TicketCard key={t.id} ticket={t} onDelete={handleTicketDelete} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
