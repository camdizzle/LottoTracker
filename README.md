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

The built client (`index.html` + `assets/`) is committed to the repo so a
plain git-push deploy leaves a ready-to-serve tree on the server. Express
still handles `/api/*` at runtime and also serves the static files as a
fallback when the webserver sends everything through Node.

## Deploying to Plesk (Apache + Node.js)

Plesk's Node.js extension wraps your app in Phusion Passenger, which
integrates with Apache automatically — you don't need shell access or
custom Apache config. All steps below are done in the Plesk web UI.

### 1. Push the code to the domain

In **Websites & Domains → `<your-domain>` → Git**, configure a Git
repository that pulls from GitHub (or push over Plesk's Git URL). Set the
deployment path to the domain's document root (usually `httpdocs`).
Enable **Automatic deployment** if you want every push to redeploy.

Make sure you have run `npm run build` locally before pushing — the
committed `index.html` and `assets/` at the repo root are what Apache
will serve.

### 2. Enable Node.js for the domain

In **Websites & Domains → `<your-domain>` → Node.js**:

| Setting                     | Value                                     |
| --------------------------- | ----------------------------------------- |
| Node.js version             | 18.x or newer                             |
| Document Root               | `/httpdocs` (or wherever the repo landed) |
| Application Mode            | `production`                              |
| Application Root            | same as Document Root                     |
| Application Startup File    | `app.js`                                  |

Click **Enable Node.js**.

### 3. Install dependencies

Still on the Node.js page, click **NPM install**. This runs
`npm install` in the application root and, via the `postinstall` hook,
installs the client dependencies too (harmless on the server — the
client is already built).

### 4. Set environment variables

Click **Application Mode → environment variables** (or the env-vars
section on the Node.js page) and add:

```
ADMIN_PASSWORD = <your-secret-here>
```

`PORT` is set automatically by Passenger — do not set it yourself.

### 5. Restart the app

Click **Restart App**. Visit `https://<your-domain>/` — you should see
the Lotto Tracker home page. Visit `/admin` and log in with the
password you set.

### How requests flow on Plesk

- Requests for real files on disk (`/`, `/index.html`, `/assets/*.js`,
  `/assets/*.css`) are served directly by Apache from the document root —
  fast, no Node involvement.
- Everything else (`/api/*`, `/history`, `/admin`) is forwarded by
  Passenger to the Node process, where Express handles the API routes
  and falls back to serving `index.html` for client-side routes.

### Redeploying after code changes

```bash
# locally
npm run build
git add index.html assets
git commit -m "Rebuild client"
git push
```

Then in Plesk, click **Restart App** on the Node.js page (or enable
automatic restart in the Plesk Git settings).

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
