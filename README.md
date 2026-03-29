# tim

**tim** (“time is money”) is a local-first time tracking CLI. It stores entries in SQLite on your machine and appends completed rows to a Google Sheet you already use as your timesheet.

## Prerequisites

- **Node.js** 22 or newer (see `.nvmrc` if you use `nvm`)
- A **Google account** with access to Google Sheets
- A **Google Cloud project** where you can enable APIs and create OAuth credentials

## 1. Google Cloud setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project.
2. Enable the **Google Sheets API** for that project (**APIs & Services → Library → Google Sheets API → Enable**).
3. Configure the **OAuth consent screen** (External is fine for personal use; add your Google account as a test user if the app stays in testing).
4. Under **APIs & Services → Credentials**, create an **OAuth 2.0 Client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs** (scroll to this section — not “Authorized JavaScript origins”): click **Add URI** and enter exactly:
     - `http://127.0.0.1:8765/oauth2callback`
   - **Authorized JavaScript origins**: leave empty, unless your console requires something. If you must add an origin, use **`http://127.0.0.1:8765`** only (no path, no trailing slash). Do **not** put the `/oauth2callback` URL here — that field rejects paths and triggers errors like *“Invalid Origin: URIs must not contain a path”*.
   - Save the **Client ID** and **Client secret**.

`tim` uses a fixed loopback port (**8765**) so you only need that one redirect URI under **Authorized redirect URIs**.

## 2. Spreadsheet setup

1. Create a **Google Spreadsheet** (one file per calendar year is the intended model).
2. Add **one sheet tab per month** with names that match what `tim` expects by default: `Jan`, `Feb`, `Mar`, … `Dec`.  
   The Sheets API **does not** create missing tabs when appending rows; those tabs must exist (you can rename tabs later and adjust `monthTabs` in `~/.tim/config.json` if needed).
3. Copy the spreadsheet **ID** from the URL:  
   `https://docs.google.com/spreadsheets/d/`**`SPREADSHEET_ID`**`/edit`

Optional: add formula columns after the four data columns (`client`, `project`, `start_time`, `end_time`) as described in your product spec; `tim` only writes the first four columns.

## 3. Install the CLI

From the repository root:

```bash
npm install
```

Run commands via npm:

```bash
npm start -- --help
```

Or invoke the binary directly:

```bash
node ./bin/tim.js --help
```

To use `tim` from anywhere without a path:

```bash
npm link
```

After that, `tim` should resolve on your `PATH` (same as any globally linked npm package).

## 4. First-time configuration (`tim init`)

1. Optionally set credentials so you are not prompted (recommended for scripts):

   ```bash
   export TIM_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   export TIM_GOOGLE_CLIENT_SECRET="your-client-secret"
   ```

2. Run:

   ```bash
   tim init
   ```

   Or: `node ./bin/tim.js init`

3. When prompted, paste the **spreadsheet ID** for the current year.
4. Complete the **browser OAuth** flow. You should see a note that redirect URI `http://127.0.0.1:8765/oauth2callback` must be allowed (see step 1 above).
5. On success, `tim` writes:
   - **Config:** `~/.tim/config.json` (includes OAuth tokens for MVP, unencrypted)
   - **Database:** `~/.tim/tim.db`

If port **8765** is already in use, free it or stop the conflicting process, then run `tim init` again.

## 5. Daily usage

| Command | Purpose |
|--------|---------|
| `tim start` | Pick a project (interactive); starts a timer (stops any running timer first). |
| `tim stop` | Stop the active timer and queue/sync to Sheets. |
| `tim status` | Show running timer and elapsed time. |
| `tim projects` | List projects. |
| `tim project <name>` | Report time for today (local). |
| `tim project <name> -w` | Current week (Monday–now, local). |
| `tim project <name> -m` | Current month (month start–now, local). |
| `tim client <name>` | Report total time for a client across all projects (today, local). |
| `tim client <name> -w` | Same for current week. |
| `tim client <name> -m` | Same for current month. |
| `tim sync` | Retry unsynced completed entries to Google Sheets. |

For **`tim client`**, `<name>` can be the **full client display name** (as stored for Google Sheets) or the **short client code** (e.g. `TLS`) once that code is set in the database.

Use **`tim --debug`** (or **`-d`**) before the subcommand for verbose API/SQL logging on stderr, for example:

```bash
tim --debug sync
```

## Configuration

- **Path:** `~/.tim/config.json`
- **Fields:** `currentYear`, `years[YYYY].spreadsheetId`, optional `years[YYYY].monthTabs` (maps month numbers `1`–`12` to tab names), and `googleOAuth` (`clientId`, `clientSecret`, `refreshToken`).

You can add another calendar year by extending `years` and pointing each year at the right spreadsheet ID.

## Clients, codes, and project names

- **`clients` table** (in `~/.tim/tim.db`): each client has a **display name** (written to the Sheet as the `client` column) and an optional **code** (2–5 letters/digits, unique), e.g. `TLS`.
- **New projects** from `tim start` → **More…** → **Create new project**: choose an existing client or **New client**. With a code, you only enter a **suffix**; the stored project name becomes `{CODE}-{suffix}` (e.g. `TLS-development`). Clients **without** a code (e.g. after upgrading from an older DB) use a single **full project name** prompt instead.
- **`tim client TLS`** (or the full display name) totals time for every entry whose `client_name` matches that client’s display name.
- **Upgraded databases** seed one `clients` row per distinct `client_name`, with **`code` empty** until you set it. To use short codes in `tim client`, set them once, for example with the SQLite CLI:

  ```bash
  sqlite3 ~/.tim/tim.db "UPDATE clients SET code = 'TLS' WHERE display_name = 'The Language School';"
  ```

## Troubleshooting

- **“Config not found”** — Run `tim init`.
- **OAuth / redirect errors** — Confirm **`http://127.0.0.1:8765/oauth2callback`** is under **Authorized redirect URIs**, not under **Authorized JavaScript origins** (origins must have no path). Ensure the Sheets API is enabled.
- **Append / range errors** — Ensure the month tab exists and its name matches `monthTabs` for that month (defaults to `Jan` … `Dec`).
- **`tim start` from Shortcuts** — The MVP expects a TTY for interactive project selection; use the terminal for `tim start`, or stop/start from a full terminal session until a non-interactive `tim start <project>` exists.

## License

ISC (see `package.json`).
