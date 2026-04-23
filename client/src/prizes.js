// Base prize tables. Jackpot marked as isJackpot.
// Keys: "<whiteMatches>_<specialMatched>"
// Mega Millions (April 2025+): $5 ticket, built-in per-ticket multiplier (2–10×).
const MM_PRIZES = {
  '5_true':  { isJackpot: true },
  '5_false': { amount: 1_000_000 },
  '4_true':  { amount: 10_000 },
  '4_false': { amount: 500 },
  '3_true':  { amount: 200 },
  '3_false': { amount: 10 },
  '2_true':  { amount: 10 },
  '1_true':  { amount: 7 },
  '0_true':  { amount: 5 },
};

const PB_PRIZES = {
  '5_true':  { isJackpot: true },
  '5_false': { amount: 1_000_000 },
  '4_true':  { amount: 50_000 },
  '4_false': { amount: 100 },
  '3_true':  { amount: 100 },
  '3_false': { amount: 7 },
  '2_true':  { amount: 7 },
  '1_true':  { amount: 4 },
  '0_true':  { amount: 4 },
};

// California Super Lotto Plus: pari-mutuel above the bottom two tiers.
// Amounts here are rough averages; actual payouts vary per draw.
const SL_PRIZES = {
  '5_true':  { isJackpot: true },
  '5_false': { amount: 28_000 },
  '4_true':  { amount: 2_000 },
  '4_false': { amount: 100 },
  '3_true':  { amount: 50 },
  '3_false': { amount: 10 },
  '2_true':  { amount: 10 },
  '1_true':  { amount: 2 },
  '0_true':  { amount: 1 },
};

const TABLES = {
  megaMillions: MM_PRIZES,
  powerball: PB_PRIZES,
  superLotto: SL_PRIZES,
};

export function computePrize(game, whiteMatches, specialMatched, ticketMultiplier, drawMultiplier) {
  const table = TABLES[game];
  if (!table) return { amount: 0 };
  const key = `${whiteMatches}_${specialMatched}`;
  const base = table[key];
  if (!base) return { amount: 0 };
  if (base.isJackpot) return { amount: 0, isJackpot: true };

  let mult = 1;
  if (game === 'megaMillions') {
    // New MM: every ticket has a built-in multiplier (2–10×).
    mult = ticketMultiplier || 1;
  } else if (game === 'powerball' && ticketMultiplier && drawMultiplier) {
    // PB match-5 with Power Play is always $2M regardless of multiplier drawn.
    if (whiteMatches === 5 && !specialMatched) return { amount: 2_000_000 };
    mult = drawMultiplier;
  }
  return { amount: base.amount * mult };
}

export function getSpecialValue(game, result) {
  if (!result) return null;
  if (game === 'megaMillions') return result.megaBall ?? null;
  if (game === 'powerball') return result.powerball ?? null;
  if (game === 'superLotto') return result.megaNumber ?? null;
  return null;
}

export function evaluateTicket(ticket, result) {
  if (!result) return { matchedWhite: [], specialMatched: false, prize: { amount: 0 } };
  const matchedWhite = ticket.numbers.filter((n) => result.whiteNumbers.includes(n));
  const special = getSpecialValue(ticket.game, result);
  const specialMatched = ticket.specialNumber != null && ticket.specialNumber === special;
  const prize = computePrize(
    ticket.game,
    matchedWhite.length,
    specialMatched,
    ticket.multiplier,
    result.multiplier
  );
  return { matchedWhite, specialMatched, prize };
}
