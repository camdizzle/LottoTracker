// NY Open Data provides free, no-auth JSON endpoints for Mega Millions and Powerball.
const MM_URL = 'https://data.ny.gov/resource/5xaw-6ayf.json?$order=draw_date%20DESC&$limit=60';
const PB_URL = 'https://data.ny.gov/resource/d6yy-54nr.json?$order=draw_date%20DESC&$limit=60';
// Unofficial CA Lottery endpoint for Super Lotto Plus past draws.
const SL_URL = 'https://www.calottery.com/api/DrawGameApi/DrawGamePastDrawResults/8/1/30';

function stripTime(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0];
}

export async function fetchMegaMillions() {
  const res = await fetch(MM_URL);
  if (!res.ok) throw new Error(`MM fetch failed: ${res.status}`);
  const data = await res.json();
  return data.map((d) => {
    const nums = String(d.winning_numbers || '').trim().split(/\s+/).map(Number);
    return {
      drawDate: stripTime(d.draw_date),
      whiteNumbers: nums.slice(0, 5),
      megaBall: Number(d.mega_ball),
      multiplier: d.multiplier ? Number(d.multiplier) : null,
    };
  });
}

export async function fetchPowerball() {
  const res = await fetch(PB_URL);
  if (!res.ok) throw new Error(`PB fetch failed: ${res.status}`);
  const data = await res.json();
  return data.map((d) => {
    const nums = String(d.winning_numbers || '').trim().split(/\s+/).map(Number);
    // NY feed: first 5 are whites, last is powerball.
    const whiteNumbers = nums.slice(0, 5);
    const powerball = nums[5];
    return {
      drawDate: stripTime(d.draw_date),
      whiteNumbers,
      powerball,
      multiplier: d.multiplier ? Number(d.multiplier) : null,
    };
  });
}

export async function fetchSuperLotto() {
  // CA Lottery has no official public API. This unofficial endpoint may change;
  // we parse defensively and fall back to an empty list on failure so the rest
  // of the app keeps working. Admins can manually refresh or rely on cached data.
  try {
    const res = await fetch(SL_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'LottoTracker/1.0' },
    });
    if (!res.ok) throw new Error(`SL fetch failed: ${res.status}`);
    const data = await res.json();
    const draws = data?.PreviousDraws || data?.previousDraws || data?.Draws || [];
    return draws
      .map((d) => {
        const rawDate = d.DrawDate || d.drawDate || d.Date;
        const winningRaw = d.WinningNumbers || d.winningNumbers || d.Numbers || [];
        const nums = winningRaw
          .map((w) => Number(w?.Number ?? w?.number ?? w))
          .filter((n) => Number.isFinite(n));
        if (nums.length < 6) return null;
        return {
          drawDate: stripTime(rawDate),
          whiteNumbers: nums.slice(0, 5),
          megaNumber: nums[5],
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('SuperLotto fetch failed:', err.message);
    return [];
  }
}
