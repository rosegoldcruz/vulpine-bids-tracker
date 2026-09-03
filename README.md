# Vulpine Bid Tracker

Upload a bid PDF → it reads the text, pulls out project name, company, unit
count, and bid amount → drops it in the dashboard with charts and a KPI
summary. Everything's editable inline if the auto-read guesses wrong.

## What's in the box
- `server.js` — the whole backend (Express + SQLite)
- `extract.js` — the "engine": reads PDF text, guesses the numbers
- `public/` — the dashboard (plain HTML/JS, Chart.js from CDN)
- `data/bids.db` — created automatically on first run (SQLite, one file)

## Run it locally first (sanity check)
```
npm install
npm start
```
Then open `http://localhost:4400`.

## Deploy to bids.vulpine.llc (matches your existing pm2 + nginx setup)

1. Copy this whole folder to the server, e.g. `/var/www/bids-tracker`
2. `cd /var/www/bids-tracker && npm install --production`
3. Start it under PM2:
   ```
   pm2 start server.js --name bids-tracker
   pm2 save
   ```
4. Point nginx at it — add a server block for `bids.vulpine.llc` that
   reverse-proxies to `http://localhost:4400` (same pattern as your other
   subdomains).
5. Point the `bids.vulpine.llc` DNS A record at the server if it isn't
   already, and run certbot for SSL.
6. Reload nginx.

That's it — no database server to install, no build step. SQLite is just a
file that lives in `data/bids.db` on the server, so back it up like any other
file if you care about the data.

## Notes on the "engine"
- Text-based PDFs (basically all of yours — anything made from Word/Google
  Docs/a proposal tool) extract cleanly.
- A scanned/photographed PDF has no text layer to read, so the fields come
  back empty and the row gets flagged "needs review" in the upload message —
  you just fill those in by hand in the table.
- The dollar amount guess looks for a line with "Total" near a $ amount
  first; if it can't find one, it grabs the largest dollar figure on the
  page.
- Everything in the table is a live editable field — click in, change it,
  it saves on blur/change. No save button needed.
