import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { formatUtc } from './datetime.js';
import { normalizeClientCode } from './client-code.js';

/**
 * @param {import('better-sqlite3').Database} db
 */
function migrateSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      display_name TEXT NOT NULL UNIQUE
    );
  `);

  const projectCols = db.prepare(`PRAGMA table_info(projects)`).all();
  const hasClientId = projectCols.some((c) => c.name === 'client_id');

  if (!hasClientId) {
    db.exec(`ALTER TABLE projects ADD COLUMN client_id INTEGER REFERENCES clients(id);`);
  }

  const names = db
    .prepare(
      `SELECT DISTINCT client_name AS n FROM (
        SELECT client_name FROM projects UNION SELECT client_name FROM entries
      ) WHERE client_name IS NOT NULL AND TRIM(client_name) != ''`,
    )
    .all();

  const insertClient = db.prepare(`INSERT OR IGNORE INTO clients (display_name, code) VALUES (?, NULL)`);
  for (const row of names) {
    insertClient.run(row.n);
  }

  db.prepare(
    `UPDATE projects SET client_id = (
      SELECT id FROM clients WHERE clients.display_name = projects.client_name
    ) WHERE client_id IS NULL`,
  ).run();
}

/**
 * @param {string} dbPath
 * @param {{ debug?: (msg: string) => void }} [opts]
 */
export function openDatabase(dbPath, opts = {}) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id),
      active INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      client_name TEXT NOT NULL,
      start_time_utc TEXT NOT NULL,
      end_time_utc TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entries_project ON entries(project_id);
    CREATE INDEX IF NOT EXISTS idx_entries_client ON entries(client_name);
    CREATE INDEX IF NOT EXISTS idx_entries_end ON entries(end_time_utc);
    CREATE INDEX IF NOT EXISTS idx_entries_synced ON entries(synced);
  `);

  migrateSchema(db);

  return wrapDb(db, opts.debug);
}

function wrapDb(db, debugLog) {
  const log = typeof debugLog === 'function' ? debugLog : () => {};

  function run(sql, params = []) {
    log(`${sql} ${JSON.stringify(params)}`);
    return db.prepare(sql).run(...params);
  }

  function all(sql, params = []) {
    log(`${sql} ${JSON.stringify(params)}`);
    return db.prepare(sql).all(...params);
  }

  function get(sql, params = []) {
    log(`${sql} ${JSON.stringify(params)}`);
    return db.prepare(sql).get(...params);
  }

  function legacyHasClientName(name) {
    const p = get(`SELECT 1 as x FROM projects WHERE client_name = ? LIMIT 1`, [name]);
    if (p) return true;
    const e = get(`SELECT 1 as x FROM entries WHERE client_name = ? LIMIT 1`, [name]);
    return Boolean(e);
  }

  return {
    raw: db,
    run,
    all,
    get,
    /** @param {string} displayName @param {string | null} code */
    insertClient(displayName, code) {
      const codeVal = code == null || code === '' ? null : normalizeClientCode(code);
      const info = run(`INSERT INTO clients (display_name, code) VALUES (?, ?)`, [displayName.trim(), codeVal]);
      return { id: Number(info.lastInsertRowid) };
    },
    /** @param {number} id */
    getClientById(id) {
      return get(`SELECT * FROM clients WHERE id = ?`, [id]);
    },
    listClientsOrdered() {
      return all(`SELECT * FROM clients ORDER BY display_name ASC`);
    },
    /** @param {string} code Uppercase normalized */
    findClientByCode(code) {
      const c = normalizeClientCode(code);
      return get(`SELECT * FROM clients WHERE code IS NOT NULL AND UPPER(code) = ?`, [c]);
    },
    /** @param {string} displayName */
    findClientByDisplayName(displayName) {
      return get(`SELECT * FROM clients WHERE display_name = ?`, [displayName]);
    },
    /**
     * Resolve CLI argument for reports: full display name, client code, or legacy exact client_name.
     * @returns {{ displayName: string, code: string | null } | null}
     */
    resolveClientForReport(arg) {
      const s = arg.trim();
      if (!s) return null;
      const byName = get(`SELECT * FROM clients WHERE display_name = ?`, [s]);
      if (byName) {
        return { displayName: byName.display_name, code: byName.code };
      }
      const byCode = get(`SELECT * FROM clients WHERE code IS NOT NULL AND UPPER(code) = ?`, [
        normalizeClientCode(s),
      ]);
      if (byCode) {
        return { displayName: byCode.display_name, code: byCode.code };
      }
      if (legacyHasClientName(s)) {
        return { displayName: s, code: null };
      }
      return null;
    },
    /**
     * @param {string} name
     * @param {string} clientName display_name copy
     * @param {number} clientId
     */
    insertProject(name, clientName, clientId) {
      const now = formatUtc(new Date());
      const info = run(
        `INSERT INTO projects (name, client_name, client_id, active, last_used_at) VALUES (?, ?, ?, 1, ?)`,
        [name, clientName, clientId, now],
      );
      return { id: Number(info.lastInsertRowid) };
    },
    /** @param {string} name */
    findProjectByName(name) {
      return get(`SELECT * FROM projects WHERE name = ?`, [name]);
    },
    /** @param {number} id */
    getProjectById(id) {
      return get(`SELECT * FROM projects WHERE id = ?`, [id]);
    },
    listProjectsOrdered() {
      return all(
        `SELECT * FROM projects WHERE active = 1 ORDER BY
           CASE WHEN last_used_at IS NULL THEN 1 ELSE 0 END,
           last_used_at DESC,
           name ASC`,
      );
    },
    /** Most recently used projects (by last_used_at). */
    getRecentProjects(limit) {
      return all(
        `SELECT * FROM projects WHERE active = 1
         ORDER BY
           CASE WHEN last_used_at IS NULL THEN 1 ELSE 0 END,
           last_used_at DESC,
           name ASC
         LIMIT ?`,
        [limit],
      );
    },
    /** @param {number} projectId */
    touchProject(projectId) {
      const now = formatUtc(new Date());
      run(`UPDATE projects SET last_used_at = ? WHERE id = ?`, [now, projectId]);
    },
    getActiveEntry() {
      return get(`SELECT * FROM entries WHERE end_time_utc IS NULL ORDER BY id DESC LIMIT 1`);
    },
    /** @param {number} projectId @param {string} clientName */
    insertOpenEntry(projectId, clientName) {
      const now = formatUtc(new Date());
      const info = run(
        `INSERT INTO entries (project_id, client_name, start_time_utc, end_time_utc, synced, created_at_utc, updated_at_utc)
         VALUES (?, ?, ?, NULL, 0, ?, ?)`,
        [projectId, clientName, now, now, now],
      );
      return { id: Number(info.lastInsertRowid) };
    },
    /** @param {number} id @param {string} endUtc */
    closeEntry(id, endUtc) {
      const now = formatUtc(new Date());
      run(`UPDATE entries SET end_time_utc = ?, synced = 0, updated_at_utc = ? WHERE id = ?`, [endUtc, now, id]);
    },
    /** @param {number} id */
    markSynced(id) {
      const now = formatUtc(new Date());
      run(`UPDATE entries SET synced = 1, updated_at_utc = ? WHERE id = ?`, [now, id]);
    },
    getUnsyncedCompletedEntries() {
      return all(
        `SELECT * FROM entries WHERE end_time_utc IS NOT NULL AND synced = 0 ORDER BY id ASC`,
      );
    },
    /** @param {number} projectId */
    listEntriesForProject(projectId) {
      return all(`SELECT * FROM entries WHERE project_id = ? ORDER BY start_time_utc ASC`, [projectId]);
    },
    /** @param {string} clientName Exact match on denormalized client_name */
    listEntriesForClient(clientName) {
      return all(`SELECT * FROM entries WHERE client_name = ? ORDER BY start_time_utc ASC`, [clientName]);
    },
    /** True if any project or entry uses this client name (exact match). */
    hasClientRecord(clientName) {
      const p = get(`SELECT 1 as x FROM projects WHERE client_name = ? LIMIT 1`, [clientName]);
      if (p) return true;
      const e = get(`SELECT 1 as x FROM entries WHERE client_name = ? LIMIT 1`, [clientName]);
      return Boolean(e);
    },
  };
}

export function databaseExists(dbPath) {
  return existsSync(dbPath);
}
