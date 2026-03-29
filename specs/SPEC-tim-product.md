# SPEC-tim-product

_Last updated: 2026-03-28_

## 1. Overview

**tim** ("time is money") is a lightweight, local-first time tracking CLI that writes raw time entries to a Google Sheets–based timesheet system the user already maintains (one spreadsheet per year, one sheet/tab per month). [cite:56]

The CLI’s primary purpose is to make starting/stopping timers and viewing basic reports fast and ergonomic from the terminal and via Mac Shortcuts, while keeping Google Sheets as the long-term source of truth. [cite:56]

## 2. Goals and non-goals

### 2.1 Goals (MVP)

- Provide a fast CLI workflow to:
  - Start tracking time for a project: `tim start`.
  - Stop the current timer: `tim stop`.
  - See current status: `tim status`.
  - Inspect basic per-project totals: `tim project <name> [-w|-m]`.
  - List/select projects: `tim projects`. [cite:56]
- Persist all entries locally (SQLite) for performance and reporting.
- Append new entries into an existing Google Sheets timesheet, using OAuth to the user’s own Drive. [cite:56]
- Work well on a single user’s multiple machines (desktop + laptop) with occasional manual edits directly in Sheets or on mobile. [cite:56]
- Be easy to install as a Node.js CLI script initially (single script in `~/bin`), with the option to later publish as an npm package. [cite:56]

### 2.2 Non-goals (MVP)

- No rich GUI or menu bar app in MVP (those are future tracks).
- No multi-user collaboration or conflict resolution beyond “Sheets is source of truth, append-only from client, manual rebuild from Sheets when needed”. [cite:56]
- No strict guarantees about overlapping timers; the app will not enforce single-active-timer constraints in v1. [cite:56]
- No advanced anonymization, billing, invoicing, or client-facing exports.
- No complex exit-code semantics; success/failure is enough for personal use. [cite:56]

## 3. Primary user and usage scenarios

### 3.1 Primary user

- Single developer/consultant working across:
  - Desktop Mac.
  - Laptop Mac.
  - Occasional phone access via direct edits to Google Sheets. [cite:56]
- Technical, comfortable with CLI tools and Node.js.

### 3.2 Key scenarios

- **Start timer from terminal:** user runs `tim start`, sees three most recently used projects plus a `More…` option, chooses with a single keystroke, and a timer starts. [cite:56]
- **Stop timer from terminal:** user runs `tim stop`, current timer stops, a new row is written locally and queued for sync to Sheets, and a minimal confirmation is printed. [cite:56]
- **Quick status:** user runs `tim status` to see whether a timer is running and for which project. [cite:56]
- **Per-project report:** user runs `tim project TLS-app -m` to see total tracked time for project `TLS-app` in the current month. [cite:56]
- **Use from Spotlight/Mac Shortcuts:** Shortcuts call `tim start` or `tim stop` so the user can control timers even when not in a terminal (no detailed Shortcut UX defined in MVP beyond invoking CLI commands). [cite:56]
- **Manual edits from phone:** user adds/edits rows directly in the monthly sheet; later, `tim` can rebuild local state for that month from Sheets. [cite:56]

## 4. High-level architecture

### 4.1 Components

- **CLI (Node.js):** main executable (`tim`) providing commands and interactive prompts.
- **Local store (SQLite):** holds entries, projects, and sync state; used for all read paths and local reporting. [cite:56]
- **Google Sheets backend:** per-year spreadsheet with per-month tabs; stores raw entry rows as the long-term archive and manual editing surface. [cite:56]
- **Config file:** `~/.tim/config.json` with spreadsheet IDs, OAuth tokens, and basic settings. [cite:56]

### 4.2 Data flow

- On `tim start` / `tim stop` / reporting commands:
  - Read/write from SQLite synchronously.
  - Attempt to append new entries to Sheets; on failure, queue unsynced items for later sync and warn the user. [cite:56]
- On `tim sync` (future/implicit command):
  - Attempt to send all queued entries to Sheets.
- On “rebuild from Sheets” for a given month (future explicit command):
  - Fetch month’s tab via Sheets API.
  - Map rows into the internal entry model and replace local month snapshot. [cite:56]

## 5. Data model (conceptual)

### 5.1 Entities

- **Client**
  - Name (free-text in Sheets, normalized internally).
- **Project**
  - Name (e.g., `TLS-app`).
  - Associated client (e.g., `The Language School`).
  - Active flag (local-only for MVP; may later sync to a config sheet). [cite:56]
- **Time entry**
  - Client (text, derived from project internally, stored explicitly in Sheets).
  - Project (text).
  - Start time (UTC, `YYYY-MM-DD hh:mm:ss`).
  - End time (UTC, `YYYY-MM-DD hh:mm:ss`). [cite:56]

### 5.2 Google Sheets layout

- One spreadsheet document per year.
- One sheet/tab per month (e.g., `Jan`, `Feb`, `Mar`, …).
- Each time entry row has columns: `client, project, start_time, end_time`, plus formula-driven columns:
  - `duration_minutes`, `client_month_hours`, `project_month_hours`, `total_month_hours`. [cite:56]
- The client relies on formulas in Sheets to compute totals, while the CLI also performs its own reporting using the local DB. [cite:56]

## 6. CLI surface (user-level view)

_User-facing description; precise contract is in SPEC-tim-cli._

- `tim init`
  - Guided setup: locate existing yearly spreadsheet (user provides ID), store config, and perform initial auth.
- `tim start`
  - If no active timer, show 3 most recently used projects + `More…`; user selects one; timer starts. [cite:56]
  - If a timer is already running, automatically stop it, start a new one on the selected project, and inform the user which project was stopped. [cite:56]
- `tim stop`
  - If a timer is running, stop it, persist entry locally, and enqueue for Sheets sync; attempt sync immediately.
  - If no timer is running, no-op with a friendly message. [cite:56]
- `tim status`
  - Show whether a timer is currently running and, if so, for which project and since when. [cite:56]
- `tim projects`
  - Show projects, emphasizing the 3 most recent ones and offering navigation to the full list.
- `tim project <name> [-w|-m]`
  - Show aggregated time for a given project for:
    - Today (default, local day starting 00:00).
    - Current week (`-w`, starting Monday local time).
    - Current month (`-m`, local time). [cite:56]

## 7. Behavior, rules, and constraints

- Time is tracked at raw seconds precision; no automatic rounding in MVP. [cite:56]
- Overlapping sessions are not explicitly prevented; starting a new timer auto-stops the previous one but does not forbid overlaps that might arise from manual edits or multiple machines. [cite:56]
- All timestamps are stored in UTC; Sheets and reports are responsible for local-time presentation. [cite:56]
- Sheets is the long-term source of truth:
  - Client app is append-only toward Sheets in v1.
  - Occasional full “rebuild month from Sheets” operations overwrite local state for that month. [cite:56]

## 8. Persistence and sync strategy

- Local SQLite DB is the primary runtime store for commands and reports.
- On every command that creates or updates an entry, the app:
  - Writes to SQLite in a transaction.
  - Attempts to append the new entry row(s) to Sheets.
  - On failure, marks entries as unsynced and warns the user (super minimal messaging). [cite:56]
- A dedicated sync flow (implicit or explicit `tim sync`) retries sending unsynced entries.
- No separate local log beyond the SQLite DB is required. [cite:56]

## 9. Authentication and configuration

- Auth via Google OAuth, storing refresh token locally in the config file (unencrypted) for MVP. [cite:56]
- Config file: `~/.tim/config.json`, including:
  - Google spreadsheet ID for the current year.
  - Mapping of year → spreadsheet IDs and month tab names.
  - Path or inline storage of OAuth tokens.
  - Other tunables (e.g., default rounding rules, though none are active for MVP). [cite:56]

## 10. Error handling and logging (user-level)

- Default output is minimal (“Started timer on TLS-app”, “Stopped timer on TLS-app”). [cite:56]
- `--debug` flag enables more verbose logging for troubleshooting, including API calls and sync behavior. [cite:56]
- Exit codes are not strictly defined for integration in MVP; simplest success/failure semantics are acceptable. [cite:56]

## 11. Future directions (out of MVP scope)

- Menu bar app showing current timer in the macOS status bar (separate small app talking to `tim`).
- Richer reports (multi-project summaries, export formats, invoicing helpers).
- Dedicated Google Sheet tab for project/client configuration, synced with local SQLite.
- Stronger multi-machine support with more sophisticated reconciliation than append-only + full-month rebuild.
- Security hardening (encrypted credential storage, team usage patterns).
