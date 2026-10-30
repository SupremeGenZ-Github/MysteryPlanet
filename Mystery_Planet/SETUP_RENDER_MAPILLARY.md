# Render + Mapillary setup

## You already have a token, client secret and authorization URLs

Use the application's **client access token** for this integration. The game reads public imagery; it does not sign players into Mapillary or upload images, so the client secret and OAuth authorization URLs are not used.

Do not send a client secret to the browser, put it in the client-token field, commit it to GitHub or share it in chat. A public client token is expected to be visible in the Mapillary viewer's browser requests.

## Enter your token once for the whole website

1. Open **Render Dashboard → your Mystery Planet web service**.
2. Open **Environment → Add Environment Variable**.
3. In the **Key** field enter `MAPILLARY_CLIENT_TOKEN`.
4. In **Value**, paste the client access token from your Mapillary application.
5. Save and redeploy/restart when Render prompts you.
6. Refresh your game → gear icon → **Mapillary street mode**.

The key/value fields are separate. Do not type `=` as part of the key. Do not use `GOOGLE_MAPS_BROWSER_KEY`; that provider is no longer part of this edition.

For a one-browser test, open the game → Settings → **Mapillary client access token** → paste the client token → **Save token on this device**. To return to the Render-configured token, click **Use website token**.

If you need a client token later, sign in to Mapillary and open the developer dashboard, register/select your application and copy its client access token. Documentation: https://mapillary.github.io/mapillary-js/docs/intro/try/

## Free Render deployment

Upload the project contents to your GitHub repository root. At the root you should see `package.json`, `server.js`, `render.yaml` and `public/`.

Create **New → Web Service**, connect the repository, then use:

| Setting | Value |
|---|---|
| Language | Node |
| Plan | Free |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Root Directory | Blank if the files are at the repository root |

Environment variables:

| Key | Value |
|---|---|
| `APP_MODE` | `postgres` |
| `DATABASE_URL` | Your existing Render database's Internal Database URL |
| `COOKIE_SECURE` | `1` |
| `MAPILLARY_CLIENT_TOKEN` | Your application's client access token |

Node 24.22.1 is pinned. Render provides `PORT`. Use the same region as your database. See [SETUP_RENDER_POSTGRESQL.md](SETUP_RENDER_POSTGRESQL.md) for the database connection, persistence, backups and free limits. No Google billing setup or Mapillary client secret is required.

Mapillary currently offers free platform access, subject to its terms and API limits. Render service/storage limits remain separate. No token means the normal maps and clue game still work.

## What imagery mode does

- Choose a world, continent or country pool, optionally narrowing to a supported starter city.
- Choose **360° panoramas only** or explicitly permit **Photos & panoramas**.
- The initial image must be within the selected city's 5 km source-centre area and the displayed non-disputed country polygon.
- A maximum of six small-area search requests is made per attempt. The viewer also makes its own imagery requests.
- Places without suitable coverage return an availability message; the app does not silently switch the requested country.
- Viewer attribution/source links remain visible. The answer is the starting image location, even if moving mode lets the player navigate farther.
- No-moving/locked controls are best efforts in a browser. Imagery metadata remains inspectable.

If a client-token error appears, check that you copied the application's client access token rather than its client secret or a private user token. Check current application settings in the Mapillary dashboard. If rate limited, wait before retrying. If the viewer cannot open, check WebGL support and connectivity. If no panorama is available, try the explicit photos-and-panoramas option.

## PostgreSQL persistence

The current edition stores server rounds, progress and optional imported geography in PostgreSQL through `DATABASE_URL`. It does not need a web-service persistent disk. A free web service can sleep; its database records remain across those restarts. Render's free PostgreSQL database expires after 30 days, so upgrade the database for long-term retention. See [the database setup guide](SETUP_RENDER_POSTGRESQL.md).

Official references: https://render.com/docs/free · https://render.com/docs/postgresql-creating-connecting · https://help.mapillary.com/hc/en-us/articles/8348198426396-Mapillary-FAQ
