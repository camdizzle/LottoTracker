# Lotto Tracker

A small family web app to track weekly lotto tickets and results for
**Mega Millions**, **Powerball**, and **California Super Lotto Plus**.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + React Router
- **Backend:** Express on Node 18+ (ESM)
- **Storage:** Plain JSON file at `data/db.json` (no native deps, so it builds
  cleanly on Windows / Node 25 without Visual Studio build tools).

## Pages

| Path        | What it does                                                          |
| ----------- | --------------------------------------------------------------------- |
| `/`         | Latest drawings for all 3 games + your tickets with match highlights. |
| `/history`  | Past drawings, collapsible by date, with the tickets for that date.   |
| `/admin`    | Password-protected ticket entry, delete, and manual results refresh.  |

## Features

- Color-coded ball UI per lottery — blue/gold for MM, red for PB, green for SL.
- Match highlighting: winning numbers glow green on your tickets; jackpot
  winners pulse yellow.
- Multiplier capture: **Megaplier** (2–5×) on MM, **Power Play** (2–10×) on PB.
  Applied to non-jackpot prizes when the ticket opted in.
- Winnings summary aggregated across all games at the top of the home page.
- Live results cached in `data/db.json` for **4 hours**, refreshed from:
  - NY Open Data for [Mega Millions](https://data.ny.gov/resource/5xaw-6ayf.json)
    and [Powerball](https://data.ny.gov/resource/d6yy-54nr.json).
  - Unofficial CA Lottery endpoint for Super Lotto Plus (falls back gracefully
    if the endpoint is unavailable).
- Live ball preview in the admin ticket form as you type numbers.

## Getting Started

```bash
# from the repo root
npm install          # installs server and client deps
npm run dev          # starts server (3001) and client (5280) together
```

Open http://localhost:5280.

### Production build

```bash
npm run build        # cleans previous build, then writes index.html + assets/ to the repo root
npm start            # serves API + static client on $PORT (default 3001)
```

The built `index.html` and `assets/` directory are placed at the **repo
root** (not inside `client/dist`) so a git-push deploy to a webserver that
serves files from the repo root works out of the box.

### Deploying via `git push`

```bash
npm run build        # regenerates index.html + assets/ at the repo root
git add index.html assets
git commit -m "Rebuild client"
git push             # pushes to your webserver
```

On the server, run `npm install --omit=dev` once and start the Node
process with `npm start` (or your process manager of choice). The Node
process only needs to handle `/api/*`; your webserver can serve
`index.html` and `/assets/*` directly from the repo root.

### Environment

Create `.env` (or set process env):

```
PORT=3001
ADMIN_PASSWORD=your-secret-here
```

If `ADMIN_PASSWORD` is not set, the default is `lotto123`. **Change it before
sharing the URL with anyone.**

## Data

`data/db.json` is created automatically on first run and is git-ignored.
Delete it to reset tickets and cached results.
