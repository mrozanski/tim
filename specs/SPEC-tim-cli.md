# SPEC-tim-cli

_Last updated: 2026-03-29_

This document defines the concrete CLI, data model, and external contracts for the **tim** Node.js CLI.

## 1. CLI commands

### 1.1 Overview

Commands in MVP:

- `tim init`
- `tim start`
- `tim stop`
- `tim status`
- `tim projects`
- `tim project <name> [-w|-m]`
- `tim client <name> [-w|-m]`
- `tim sync` (implicit in other commands, but spec’d explicitly for clarity)

Global flags:

- `--debug` (or `-d`): enable verbose logging for troubleshooting (API requests/responses, SQLite queries, sync decisions).

Exit codes (MVP):

- `0` on success.
- Non-zero on unexpected failure (implementation can keep this simple; no strict contract needed beyond “0 = success”). [cite:56]

### 1.2 `tim init`

**Purpose**: Initial setup of configuration and Google Sheets linkage.

Behavior:

- Prompts the user for:
  - Google Sheets yearly spreadsheet ID (for the current year).
- Runs OAuth flow in the browser to obtain tokens; stores refresh token locally. [cite:56]
- Writes `~/.tim/config.json` with:
  - `currentYearSpreadsheetId` (for current year).
  - Map `years[YYYY].spreadsheetId`.
  - `googleOAuth` tokens.
- Ensures local SQLite DB exists and initializes schema if needed.
- Does **not** create the spreadsheet; user is expected to create it ahead of time. [cite:56]

### 1.3 `tim start`

**Purpose**: Start a timer for a project.

Arguments:

- No positional arguments in MVP; project is selected interactively.

Behavior:

1. Load local SQLite DB and config.
2. Determine “3 most recently used” projects based on recent time entries (by last start or end time) from the local DB. [cite:56]
3. Display an interactive prompt:
   - Options 1–3: most recent projects.
   - Option 4 (or similar): `More…` to show full project list / creation flow.
4. User selects via single keystroke or arrow + enter.
5. If an active timer exists:
   - Automatically stop that timer (set end_time to now in UTC) and persist update.
   - Inform user which project was stopped.
6. Start a new timer:
   - Create a new entry with `client` (derived from project), `project`, `start_time` (now UTC), `end_time` = `null`.
   - Persist to SQLite.
7. Attempt to sync affected entries (if any finished due to auto-stop) to Sheets:
   - If Sheets write fails, mark them unsynced and warn (minimal message).

**Create new project** (from `More…`):

1. User chooses an existing **client** (from the `clients` table) or **New client**.
2. **New client**: prompt for display name (used for Sheets `client` column) and a short **client code** (2–5 characters, `A–Z` / `0–9`, unique); insert a `clients` row.
3. If the client has a **code**, prompt for a **project suffix**; stored project name is `{code}-{suffix}` (e.g. `TLS-development`).
4. If the client has **no code** (e.g. legacy migrated row), prompt for the **full project name** instead.
5. Insert `projects` with `client_id` FK and denormalized `client_name` = client’s `display_name`; entries continue to use that full name for Sheets.

Notes:

- No command-line override for project name in MVP; everything goes through the recents + `More…` UI. [cite:56]

### 1.4 `tim stop`

**Purpose**: Stop the current timer, if any.

Behavior:

1. Load DB; find active timer (entry with `end_time IS NULL`).
2. If none found:
   - Print a friendly message (e.g., `No active timer.`) and exit 0.
3. If found:
   - Set `end_time` to now UTC.
   - Save entry in SQLite.
   - Attempt to append a row to the current month’s sheet.
   - On success: mark entry as synced.
   - On failure: mark entry as unsynced and print a minimal warning.

### 1.5 `tim status`

**Purpose**: Show current timer state.

Behavior:

1. Load DB; find active timer (entry with `end_time IS NULL`).
2. If none:
   - Print `No active timer.`
3. If found:
   - Print minimal status: project name and elapsed time (computed from `start_time` to now, using UTC → local display if desired). [cite:56]

### 1.6 `tim projects`

**Purpose**: Show project list and support selection in interactive flows.

Behavior (when run directly):

- Display a list of projects from local DB, ideally including:
  - Top 3 most recently used projects (marked or ordered first).
  - Rest of projects alphabetically or by last used.
- For MVP, this can be a simple textual list without additional commands.

Implementation notes:

- Projects are defined by usage in entries plus any locally created project records in a `projects` table.
- Client association is stored in the project record, not entered manually on each timer start. [cite:56]

### 1.7 `tim project <name> [-w|-m]`

**Purpose**: Basic reporting for a single project.

Arguments:

- `<name>`: project name (exact match against project records).
- Options:
  - No flag: time for today (local time, 00:00 → now).
  - `-w`: current week, starting Monday (local time).
  - `-m`: current month (local time). [cite:56]

Behavior:

1. Resolve project by name via local DB.
2. Compute local date-range boundaries according to the flag.
3. Query entries for this project whose start/end fall within the range.
4. Sum durations using `end_time - start_time` (using UTC internally, converting to local date boundaries for filtering).
5. Print a minimal summary (e.g., `TLS-app: 3h 42m this month`).

### 1.8 `tim client <name> [-w|-m]`

**Purpose**: Basic reporting for a single client across all projects.

Arguments:

- `<name>`: client **display name** (exact match against `clients.display_name`), or **client code** (exact match against `clients.code`, case-insensitive), or legacy exact match against `entries.client_name` / `projects.client_name` when no `clients` row exists.
- Options: same as `tim project` — no flag (today, local), `-w` (week from Monday), `-m` (month from first day).

Behavior:

1. Resolve client to a canonical display name (for aggregation over `entries.client_name`).
2. If unresolvable, exit with an error.
3. Load all entries with that `client_name` (any project).
4. Compute the same local date-range boundaries and overlap-sum of durations as `tim project`.
5. Print a minimal summary using the **display name** (e.g., `The Language School: 5h 10m this week`).

### 1.9 `tim sync`

**Purpose**: Retry syncing any unsynced entries to Sheets.

Behavior:

1. Query local DB for entries with `synced = false` (or `synced_at IS NULL`).
2. For each entry with a non-null `end_time`:
   - Append to the appropriate month tab.
   - On success: mark as synced.
   - On failure: leave as unsynced and, if `--debug` is on, print error details.
3. For entries with `end_time IS NULL`, do not sync (they represent running timers).

Notes:

- Other commands are allowed to call the sync logic opportunistically after writes.

## 2. Local storage contract (SQLite)

### 2.1 Tables

Implementation may adjust names, but the logical schema should support:

#### `clients`

- `id` (INTEGER PRIMARY KEY)
- `code` (TEXT, unique, nullable for legacy migrations; short label, e.g. `TLS`)
- `display_name` (TEXT, unique; full name written to Sheets as `client`)

#### `projects`

- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT, unique, e.g., `TLS-development`)
- `client_name` (TEXT, denormalized copy of `clients.display_name` for convenience)
- `client_id` (INTEGER, FK → `clients.id`, nullable only during migration backfill)
- `active` (BOOLEAN, default true)
- `last_used_at` (TEXT timestamp, UTC)

#### `entries`

- `id` (INTEGER PRIMARY KEY)
- `project_id` (INTEGER, FK → projects.id)
- `client_name` (TEXT, denormalized from project for convenience)
- `start_time_utc` (TEXT, `YYYY-MM-DD hh:mm:ss`)
- `end_time_utc` (TEXT, nullable until stopped)
- `synced` (BOOLEAN, default false)
- `created_at_utc` (TEXT)
- `updated_at_utc` (TEXT)

### 2.2 Invariants and behavior

- Exactly zero or one entry may be in “active” state at a time on a single machine (enforced by "auto-stop previous on new start"). [cite:56]
- Time is stored in UTC; all comparisons and aggregations use UTC; local-only for presentation and range selection. [cite:56]
- Project → client association is controlled via `projects.client_id` / `clients.display_name`; `entries.client_name` matches the client’s display name for Sheets.

## 3. Google Sheets contract

### 3.1 Layout

- One Google Spreadsheet per year.
- One sheet/tab per month (e.g., `Jan`, `Feb`, etc.), agreed naming convention.
- Columns per entry row (left to right):
  - `client`
  - `project`
  - `start_time` (UTC, `YYYY-MM-DD hh:mm:ss`)
  - `end_time` (UTC, `YYYY-MM-DD hh:mm:ss`)
  - Additional formula columns set up manually in the sheet:
    - `duration_minutes`
    - `client_month_hours`
    - `project_month_hours`
    - `total_month_hours` [cite:56]

### 3.2 Writes from CLI

- The CLI uses `spreadsheets.values.append` (VALUE_INPUT_OPTION = `RAW`) to append a row with only the first four columns (`client, project, start_time, end_time`). [cite:56]
- It does **not** attempt to write or update formula columns.

### 3.3 Read/Rebuild behavior

- For MVP, rebuild-from-Sheets is a separate command/flow (not yet implemented but must be anticipated):
  - Fetch all rows from a month tab.
  - Map each row into `entries` records, inferring projects and clients.
  - Replace local entries for that month.
- Manual changes in Sheets are considered authoritative once imported during a rebuild.

## 4. Config and auth

### 4.1 Config file

Location:

- `~/.tim/config.json`

Suggested structure (pseudo-JSON):

```json
{
  "currentYear": 2026,
  "years": {
    "2026": {
      "spreadsheetId": "...",
      "monthTabs": {
        "1": "Jan",
        "2": "Feb"
      }
    }
  },
  "googleOAuth": {
    "clientId": "...",
    "clientSecret": "...",
    "refreshToken": "..."
  }
}
```

Notes:

- MVP is fine with storing credentials unencrypted. [cite:56]

### 4.2 Auth flow

- `tim init` triggers OAuth authorization flow, opening a browser window.
- On success, tokens are saved to config.
- Subsequent commands load tokens and refresh as needed.

## 5. Logging and debug mode

### 5.1 Default logging

- Print only high-level messages on success:
  - `Started timer on TLS-app.`
  - `Stopped timer on TLS-app.`
  - `No active timer.` [cite:56]

### 5.2 `--debug`

- When `--debug` is present:
  - Log SQL queries (at least in a summarized form).
  - Log Google Sheets API calls and failures.
  - Log decisions about syncing (which entries are queued, which are skipped, etc.). [cite:56]

## 6. Mac Shortcuts and Spotlight (MVP expectations)

- No special behavior beyond being callable as a CLI binary.
- Shortcuts can invoke `tim start` and `tim stop` without additional parameters.
- No separate UX contract for Shortcuts in MVP; they piggyback on the same behavior as terminal invocations. [cite:56]

## 7. Open questions / future extensions

- Add non-interactive `tim start <project>` path for automation.
- Formalize `rebuild` command for month/year.
- Add menu bar integration via separate macOS helper app calling `tim status` periodically.
- Add project config sheet and sync of `projects` table. [cite:56]
