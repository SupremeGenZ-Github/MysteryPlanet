# Connect Mystery Planet to your existing Render PostgreSQL

## 1. Copy your database URL

Open **Render Dashboard → your PostgreSQL database → Connect** (or its Info page).
Copy **Internal Database URL**. The database and web service must be in the same Render account and region for the internal URL to work. If the database is in another region, create the web service in that database's region.

Keep this full URL private: it includes the database username and password. Do not commit it, put it in frontend JavaScript or share it in chat.

## 2. Upload the updated code

Extract the ZIP and upload the contents of `Mystery_Planet/` into your GitHub repository root. Keep `package.json`, `package-lock.json`, `server.js`, `migrations/` and `public/` together. Replace existing source files with this version; keep your real secrets in Render Environment.

Use **Web Service → Settings**:

| Setting | Value |
|---|---|
| Runtime | Node |
| Instance | Free is supported |
| Region | Same as your PostgreSQL database |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Root Directory | Blank when project files are at repository root |

## 3. Enter environment variables

Open **Web Service → Environment → Add Environment Variable**:

| Key | Value |
|---|---|
| `DATABASE_URL` | Paste your full **Internal Database URL** |
| `APP_MODE` | `postgres` |
| `COOKIE_SECURE` | `1` |
| `MAPILLARY_CLIENT_TOKEN` | Your Mapillary application's public client access token |

The key and value go into separate fields. Do not put `=` in the key field.
Remove the old `DATABASE_PATH`; PostgreSQL does not use it. Render supplies `PORT`. No `PGPASSWORD`, separate username, client secret or OAuth URL is needed.

Click **Save, rebuild, and deploy**. Tables and indexes are created automatically in the `mystery_planet` schema at server startup without dropping existing rows. Unrelated public-schema tables are not used. You do not need an SQL editor. If the URL is missing or the database is unreachable, PostgreSQL mode refuses to start instead of quietly falling back to temporary SQLite.

`render.yaml` also uses your existing database: enter its URL when the Blueprint asks for `DATABASE_URL`. It declares only a web service, not another database. Set its `region` to your database's region before using it.

## 4. Check the connection

Open `https://YOUR-SERVICE.onrender.com/api/health`. Expected fields:

```json
{"ok":true,"databaseBackend":"postgres","deploymentMode":"postgres","serverSessionsTemporary":false,"progressStorage":"browser-and-server"}
```

Other fields are also returned, including your public Mapillary client token; never share a health screenshot if you consider that client token private. The private database URL is never returned. `/healthz` also checks the database and returns 503 if it is unavailable.

Complete a clue round, redeploy, and revisit using the same browser/cookies. Server progress and rounds remain in PostgreSQL. The browser passport has its own Settings export/import. Clearing cookies changes the anonymous player identity; this edition does not add accounts or cross-device passport synchronization.

## Free versus persistent hosting

A free web service can still sleep after inactivity. Keeping server records in PostgreSQL does not make the web service continuously awake. The next visit wakes it, and the database holds its records across web-service sleep, restart and redeploy.

**Render Free PostgreSQL expires 30 days after creation and has 1 GB storage.** It is for testing, not indefinite free storage. Upgrade the existing database before expiry to retain it long term. Paid database storage does not require a paid disk on the web service. Free plans do not provide managed backups.

## Existing SQLite data

Switching `DATABASE_URL` starts using PostgreSQL; it does not copy an earlier SQLite database. Existing PostgreSQL rows are preserved. Browser passports remain local and can be exported/imported in Settings. If old server-side SQLite records matter, preserve that database before replacing a temporary deployment; no automatic SQLite-to-PostgreSQL migration is included.

## Optional full geography import

Normal clue play uses bundled data and requires no import. The worldwide source and its indexes exceed free database capacity; do not load them into a 1 GB free instance. Use a sufficiently sized paid database and a machine with enough source download space. All commands below honor `DATABASE_URL`:

```bash
node scripts/download-geonames.js ./raw/allCountries.zip
node scripts/import-geonames.js ./raw/allCountries.zip
npm run index:geography
npm run audit:geography
```

Run a large import from a stable development/admin machine. On that machine use the **External Database URL** with `sslmode=require` (append `?sslmode=require`, or `&sslmode=require` when it already has query parameters), and permit that machine's IP in the database's networking settings. Never paste a URL containing credentials into a public terminal transcript. The import resumes committed checkpoints and saves coverage reports in PostgreSQL.

The driver honors TLS parameters in `DATABASE_URL`; no global certificate-verification bypass is enabled. Same-region Render internal connections work with the supplied internal URL. See Render's connection documentation for optional TLS requirements.

## Backups

On a trusted admin machine with a compatible PostgreSQL `pg_dump` installed, set `DATABASE_URL` privately and run:

```bash
npm run backup -- ./backups/mystery-planet.dump
```

A consistent custom-format backup is written. The command refuses to overwrite an existing file and never places the connection URL in command arguments or output. `pg_dump` must be at least the server's major version. Use `pg_restore` with a separate target database to validate recovery; a backup on an ephemeral web-service filesystem is not durable. Paid Render databases also provide managed recovery options; check your plan.

References: [Render connections](https://render.com/docs/postgresql-creating-connecting), [Render free limits](https://render.com/docs/free), [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html).
