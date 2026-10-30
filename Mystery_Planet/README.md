# Mystery Planet 🌍

**Follow the clues. Find the place. Discover the world.**

Mystery Planet is an educational geography detective game built with **HTML, CSS and JavaScript**, with a **Node.js** server. Explore a real-world atlas, identify mystery countries, regions and cities, build a passport of discoveries, and try optional **Mapillary street-imagery guessing**.

## Features

- Country, administrative-region, city and mixed clue rounds.
- Multiple-choice, typed-answer and map-pin guesses.
- Progressive hints, difficulty levels, timed or relaxed play, and endless exploration.
- A reproducible daily challenge with spoiler-free result sharing.
- XP, achievements, streaks, personal bests and a review queue.
- A browser-saved passport with export/import backups.
- Interactive country polygons, continent views, smooth cameras, pan/zoom and microstate markers.
- Administrative boundary drill-down where source geometry is available.
- Separate dashed dispute overlays, source notes and an honest coverage report.
- Optional Mapillary imagery: 360° panoramas or community photos, a separate guess atlas, a timer and a distance-based result.
- Light/dark themes, keyboard controls, mobile layouts and reduced-motion settings.

## Technology

| Part | Technology |
|---|---|
| Frontend | Plain HTML, CSS and JavaScript ES modules |
| Backend | Node.js 24.22.1 |
| Server storage | PostgreSQL on Render; optional SQLite for offline local development |
| Street imagery | Mapillary API + MapillaryJS 4.1.2 |
| Geography | GeoNames, Natural Earth and selected geoBoundaries snapshots |
| Deployment | Render native Node web service |

No React, TypeScript, Python or Docker is required. Normal clue-based gameplay works without an imagery token or an AI API key.

## Quick start

Install Node.js **24.22.1**, then run:

```bash
npm ci
npm run build
npm start
```

Open **http://localhost:8000**.

For local offline development, no configuration is required. To connect PostgreSQL locally, copy `.env.example` to `.env` and enter `DATABASE_URL`. To keep using offline SQLite with that file, set `APP_MODE=local` and leave `DATABASE_URL` blank. Existing process/Render environment values take precedence over `.env`. Open the app through HTTP, not `file://`, because it uses ES modules and data fetches.

```bash
npm test       # Run the JavaScript checks (Postgres integration needs TEST_DATABASE_URL)
npm run build # Prepare Mapillary viewer assets and validate required files
```

## Publish on Render Free

Upload the extracted project **contents** to the root of a GitHub repository. `package.json`, `server.js`, `render.yaml` and `public/` should be directly inside that root.

Create **Render → New → Web Service**, connect the repository, and use:

| Setting | Value |
|---|---|
| Language | Node |
| Instance | Free |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Root Directory | Blank when the project files are at the repository root |

The included `.node-version` pins Node 24.22.1. `PORT` is supplied by Render; the server binds to `0.0.0.0:$PORT`.

Set these in **your web service → Environment**:

| Variable | Free-service value |
|---|---|
| `APP_MODE` | `postgres` |
| `DATABASE_URL` | Your existing Render PostgreSQL **Internal Database URL** |
| `COOKIE_SECURE` | `1` |
| `MAPILLARY_CLIENT_TOKEN` | Your application's public client access token; optional for clue play |

The database and web service must be in the same Render region. Tables are created automatically in a separate `mystery_planet` schema. Remove the old `DATABASE_PATH` variable. The included `render.yaml` declares only a web service, so it can use your existing PostgreSQL database without creating a second one.

### Persistence and free limits

Rounds, anonymous server progress, imported geography and coverage reports use PostgreSQL whenever `DATABASE_URL` is set. Web-service restarts/redeploys do not erase those database rows, and no web-service persistent disk is required. PostgreSQL mode refuses to start when configuration or connectivity is missing; it does not silently fall back to SQLite.

A free web service can still sleep. **Render Free PostgreSQL expires after 30 days and is limited to 1 GB.** Upgrade the database before expiry for long-term storage. See [Render's current limits](https://render.com/docs/free). Browser passports remain local; accounts and cross-device passport synchronization are not added. Clearing guest cookies changes the anonymous server identity.

Switching databases does not migrate old SQLite rows. Keep an old SQLite backup if its server records matter. Browser passport export/import remains available in Settings.

See [SETUP_RENDER_POSTGRESQL.md](SETUP_RENDER_POSTGRESQL.md) for exact fields and troubleshooting.

To run database integration tests, set `TEST_DATABASE_URL` to a **disposable test database**, then run `npm test`. These tests import a tiny geography fixture and create test records. Never point them at production.

## Mapillary setup

1. Sign in at [Mapillary](https://www.mapillary.com/).
2. Register/select an application in the developer dashboard and copy its **client access token**.
3. In **Render → your service → Environment**, add `MAPILLARY_CLIENT_TOKEN` with that token as its value, then redeploy.
4. Open the game → **Settings → Mapillary street mode**.

You can also enter a client token in the game's Settings for one browser. A device token takes priority; **Use website token** restores the token configured on the server.

**The client secret and OAuth authorization URLs are not required. Do not put a client secret or private user token into the browser field.** A public client token is visible in browser requests by design.

This implementation uses Mapillary, not Google Maps or Google Street View. No Google billing account is needed for it. Mapillary currently offers free platform access, subject to its terms and API limits. Render hosting/storage costs are separate.

The viewer loads only when imagery mode starts. It preserves Mapillary's attribution and image-source links. Community coverage varies: many images are ordinary photographs, not panoramas, and some places have no suitable imagery. Select **360° panoramas only** or explicitly allow **Photos & panoramas**.

Each round checks imagery within a **5 km city-centre area** and the displayed non-disputed country boundary. This is a source-centre pool, not a verified city boundary. Search is bounded to six requests per attempt; the interactive viewer makes additional imagery requests. Missing coverage never silently substitutes another country. The answer is the starting image's location. Movement locks are best-effort browser controls, not perfect anti-cheat.

See [SETUP_RENDER_MAPILLARY.md](SETUP_RENDER_MAPILLARY.md) for full setup and persistence instructions.

## Geographic coverage

| Layer | Included in the download |
|---|---:|
| Countries, territories and separately classified entities | 255 |
| UN members / observer states | 193 / 2 |
| Administrative boundary features | 10,759 |
| Capital-city starter records | 241 |
| Pre-verified Mapillary imagery locations | 0; checked at play time |

These are sourced snapshots, not a guarantee that every administrative boundary is current. Second-level geometry is supplied for India (2021), USA (2018) and Russia (2017); deeper geometry for every country is not included.

The original full GeoNames source audit scanned **13,483,471 source rows**, importing **5,234,733 populated places** and **543,709 administrative records**. Those audit reports remain in `public/data/`. The multi-gigabyte database itself is **not bundled** or automatically present on Render Free.

The supplied JavaScript importer has no population/country cutoff, preserves alternate names and stable source IDs, supports resumable checkpoints and flags unresolved administrative parents. Its JS implementation is integration-tested on a fixture. No source guarantees every settlement worldwide; database inclusion, geometry availability, clue readiness and imagery coverage are separate states.

## Optional worldwide import and backups

Starter country, region and city play works without a large import. The worldwide gazetteer exceeds the free database's 1 GB capacity. With an adequately sized paid PostgreSQL database, set `DATABASE_URL` privately on a stable admin machine and run:

```bash
node scripts/download-geonames.js ./raw/allCountries.zip
node scripts/import-geonames.js ./raw/allCountries.zip
npm run index:geography
npm run audit:geography
```

These tools support PostgreSQL and optional local SQLite. Imports keep checkpoints, exact source parents and source attribution. Search uses PostgreSQL full-text indexes, with prefix matching for names. Missing or ambiguous administrative links stay unverified. Full-source import is not performed during deployment.

For PostgreSQL backups, install a compatible `pg_dump` on a trusted admin machine, set `DATABASE_URL`, then run `npm run backup -- ./backups/mystery-planet.dump`. Keep backups off the ephemeral web service and test restoring into a separate database. The deployment does not install `pg_dump` automatically.

Local SQLite remains available when `DATABASE_URL` is absent and `APP_MODE=local`; `DATABASE_PATH` then selects its file. The optional legacy `render.persistent.yaml` is for paid SQLite/disk hosting only; leave `DATABASE_URL` unset for that configuration. PostgreSQL is the default Render setup.

## Project layout

| File / directory | Purpose |
|---|---|
| `public/index.html` | Page structure |
| `public/style.css` | Responsive layout and themes |
| `public/app.js` | Game UI, atlas, passport and settings |
| `public/core.js` | Shared clues, scoring, seeds and geometry checks |
| `public/street.js` | Mapillary search, viewer and street-round lifecycle |
| `public/guess-map.js` | Guess atlas without paid map services |
| `public/vendor/mapillary/` | Pinned MapillaryJS distribution and license notices |
| `public/data/` | Geographic snapshots, coverage and attribution |
| `server.js`, `round-engine.js` | Server API and authoritative clue rounds |
| `store.js`, `config.js`, `migrations/` | PostgreSQL/SQLite storage, schema and environment settings |
| `scripts/` | Imports, indexes, audit, backup and optional AI editorial helper |
| `tests/` | JavaScript tests |
| `SOURCE_REGISTER.md`, `NOTICE.md` | Source and third-party license details |

## Optional grounded AI editorial tool

The normal game uses source-backed templates. An optional tool can propose alternative wording from supplied verified facts:

```bash
node scripts/ai-clues.js verified-facts.json var/clue-proposals.json
```

Set server-only `OPENAI_API_KEY` and `OPENAI_MODEL` only when using that tool. Proposals reference supplied fact IDs, remain `verified:false`, and are excluded from scored play until reviewed. The language model is not the geographic database. No fictional news is presented as fact.

## License and credits

Original Mystery Planet application code is offered under the [MIT License](LICENSE). Third-party libraries and geographic data retain their own licenses; the root code license does not replace them.

- **MapillaryJS:** MIT, with its original notice retained in `public/vendor/mapillary/LICENSE`.
- **Mapillary imagery:** contributor imagery under CC BY-SA; attribution and source links are preserved. Imagery is loaded from the provider, not bundled in this repository.
- **GeoNames:** CC BY 4.0.
- **Natural Earth:** public domain.
- **India/Russia adapted geoBoundaries data:** ODbL 1.0, with source notices and license text retained.
- **USA source county geometry:** public domain.
- **Auroral Chronicle:** user-provided camera/projection reference; retained source notices apply.

See [SOURCE_REGISTER.md](SOURCE_REGISTER.md), [NOTICE.md](NOTICE.md) and `public/data/licenses/` for full attribution. Retain those files when sharing or publishing the project.

## Verification limits

Automated checks cover the geography/scoring core, importer, server lifecycle and Mapillary search/error/coverage rules. A valid Mapillary client token is needed to live-test account authorization, real imagery and WebGL playback. No Render deployment, paid disk purchase or live token-based imagery test is claimed by this source package.
