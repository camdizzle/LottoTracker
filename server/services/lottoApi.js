// --- Mega Millions ---
// Primary: official megamillions.com SOAP-ish JSON endpoint (updates within ~30 min of draw).
// Fallback: NY Open Data (free, no-auth, but can lag 12–24 h).
const MM_OFFICIAL_LATEST = 'https://www.megamillions.com/cmspages/utilservice.asmx/GetLatestDrawData';
const MM_OFFICIAL_HISTORY =
  'https://www.megamillions.com/cmspages/utilservice.asmx/GetDrawingPagingData?pageNumber=1&pageSize=30';
const MM_NY_URL =
  'https://data.ny.gov/resource/5xaw-6ayf.json?$order=draw_date%20DESC&$limit=60';

// --- Powerball ---
// NY Open Data is the most reliable free source for PB.
const PB_URL =
  'https://data.ny.gov/resource/d6yy-54nr.json?$order=draw_date%20DESC&$limit=60';

// --- Super Lotto Plus ---
// Unofficial CA Lottery endpoint — can go down for maintenance.
const SL_URL =
  'https://www.calottery.com/api/DrawGameApi/DrawGamePastDrawResults/8/1/30';

function stripTime(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0];
}

// ─── Mega Millions ────────────────────────────────────────────────────────────

async function fetchMMOfficial() {
  // History endpoint gives us 30 draws with structured fields.
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const startStr = `${String(start.getMonth() + 1).padStart(2, '0')}%2F01%2F${start.getFullYear()}`;
  const endStr = `${String(now.getMonth() + 1).padStart(2, '0')}%2F${String(now.getDate()).padStart(2, '0')}%2F${now.getFullYear()}`;
  const url = `${MM_OFFICIAL_HISTORY}&startDate=${startStr}&endDate=${endStr}`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`MM official fetch failed: ${res.status}`);
  const text = await res.text();

  // Response is XML-wrapped JSON: <string xmlns="...">{...}</string>
  let json;
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    json = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } else {
    // Maybe it's already plain JSON
    json = JSON.parse(text);
  }

  const draws = json.DrawingData || json.drawingData || [];
  if (!Array.isArray(draws) || draws.length === 0) {
    throw new Error('MM official returned no draws');
  }

  return draws.map((d) => {
    const megaplier = d.Megaplier != null && d.Megaplier > 0 ? d.Megaplier : null;
    return {
      drawDate: stripTime(d.PlayDate),
      whiteNumbers: [d.N1, d.N2, d.N3, d.N4, d.N5].map(Number),
      megaBall: Number(d.MBall),
      multiplier: megaplier,
    };
  });
}

async function fetchMMNY() {
  const res = await fetch(MM_NY_URL);
  if (!res.ok) throw new Error(`MM NY fetch failed: ${res.status}`);
  const data = await res.json();
  return data.map((d) => {
    const nums = String(d.winning_numbers || '')
      .trim()
      .split(/\s+/)
      .map(Number);
    return {
      drawDate: stripTime(d.draw_date),
      whiteNumbers: nums.slice(0, 5),
      megaBall: Number(d.mega_ball),
      multiplier: d.multiplier ? Number(d.multiplier) : null,
    };
  });
}

export async function fetchMegaMillions() {
  // Try official site first (faster updates), fall back to NY Open Data.
  try {
    return await fetchMMOfficial();
  } catch (err) {
    console.warn('MM official failed, trying NY Open Data:', err.message);
    return await fetchMMNY();
  }
}

// ─── Powerball ────────────────────────────────────────────────────────────────

export async function fetchPowerball() {
  const res = await fetch(PB_URL);
  if (!res.ok) throw new Error(`PB fetch failed: ${res.status}`);
  const data = await res.json();
  return data.map((d) => {
    const nums = String(d.winning_numbers || '')
      .trim()
      .split(/\s+/)
      .map(Number);
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

// ─── Super Lotto Plus ─────────────────────────────────────────────────────────

// Helper: extract numbers from WinningNumbers which can be either an array or
// a keyed object like { "0": { Number: "1" }, "1": { Number: "5" }, ... }.
function parseWinningNumbers(raw) {
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : Object.values(raw);
  return entries
    .map((w) => Number(w?.Number ?? w?.number ?? w))
    .filter((n) => Number.isFinite(n));
}

function parseSLDraws(draws) {
  return draws
    .map((d) => {
      const rawDate = d.DrawDate || d.drawDate || d.Date;
      const nums = parseWinningNumbers(
        d.WinningNumbers || d.winningNumbers || d.Numbers
      );
      if (nums.length < 6) return null;
      return {
        drawDate: stripTime(rawDate),
        whiteNumbers: nums.slice(0, 5),
        megaNumber: nums[5],
      };
    })
    .filter(Boolean);
}

// Fallback: scrape the Super Lotto game page HTML for the latest draw.
async function scrapeSuperLottoPage() {
  const res = await fetch('https://www.calottery.com/draw-games/superlotto-plus', {
    headers: { 'User-Agent': 'Mozilla/5.0 LottoTracker/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`SL page fetch failed: ${res.status}`);
  const html = await res.text();

  // Extract draw date: <span class="draw-date"><strong>WED/APR 15, 2026</strong>
  const dateMatch = html.match(/draw-date[^>]*>.*?(\w{3})\/(\w{3})\s+(\d{1,2}),\s+(\d{4})/i);
  if (!dateMatch) throw new Error('Could not parse draw date from SL page');

  const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
  const mon = months[dateMatch[2].toUpperCase()];
  const day = dateMatch[3].padStart(2, '0');
  const drawDate = `${dateMatch[4]}-${mon}-${day}`;

  // Extract winning numbers from: <span class="winning-numbers-inner-wrapper">1</span>
  const numMatches = [...html.matchAll(/winning-numbers-inner-wrapper[^>]*>(\d+)</g)];
  if (numMatches.length < 6) throw new Error('Could not parse winning numbers from SL page');
  const nums = numMatches.map((m) => Number(m[1]));

  return [
    {
      drawDate,
      whiteNumbers: nums.slice(0, 5),
      megaNumber: nums[5],
    },
  ];
}

export async function fetchSuperLotto() {
  // Try the API endpoint first; if it fails (503, bad data), fall back to
  // scraping the game page HTML for the latest draw.
  try {
    const res = await fetch(SL_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'LottoTracker/1.0' },
    });
    if (!res.ok) throw new Error(`SL API ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) throw new Error(`SL API returned ${ct || 'non-JSON'}`);
    const data = await res.json();

    // Parse PreviousDraws (main list of past results).
    const draws =
      data?.PreviousDraws || data?.previousDraws || data?.Draws || [];
    const drawList = Array.isArray(draws) ? draws : Object.values(draws);
    let results = parseSLDraws(drawList);

    // Also check MostRecentDraw in case PreviousDraws is stale.
    const recent = data?.MostRecentDraw;
    if (recent) {
      const parsed = parseSLDraws([recent]);
      if (parsed.length > 0) {
        const already = results.some((r) => r.drawDate === parsed[0].drawDate);
        if (!already) results.unshift(parsed[0]);
      }
    }

    if (results.length > 0) return results;
    throw new Error('SL API returned no valid draws');
  } catch (apiErr) {
    console.warn('SL API failed, trying page scrape:', apiErr.message);
    try {
      return await scrapeSuperLottoPage();
    } catch (scrapeErr) {
      console.warn('SL page scrape also failed:', scrapeErr.message);
      return [];
    }
  }
}
