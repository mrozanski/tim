import { createSheetsClient } from './google-auth.js';
import { appendEntryRow, entryRowForSheets } from './sheets.js';
import { debug } from './logger.js';

/**
 * @param {ReturnType<import('./db.js').openDatabase>} db
 * @param {import('./config.js').TimConfig} config
 */
export async function syncUnsyncedEntries(db, config) {
  const oauth = config.googleOAuth;
  if (!oauth?.refreshToken) {
    throw new Error('Missing Google OAuth refresh token. Run tim init.');
  }

  const sheets = createSheetsClient(oauth);
  const pending = db.getUnsyncedCompletedEntries();
  let ok = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      const row = entryRowForSheets(db, entry);
      await appendEntryRow(sheets, config, row);
      db.markSynced(entry.id);
      ok += 1;
      debug('synced entry', entry.id);
    } catch (e) {
      failed += 1;
      debug('sync failed for entry', entry.id, e);
    }
  }

  return { ok, failed, total: pending.length };
}

/**
 * Try to sync one entry; on failure leaves unsynced.
 * @param {ReturnType<import('./db.js').openDatabase>} db
 * @returns {Promise<boolean>} true if synced or nothing to do
 */
export async function trySyncEntry(db, config, entry) {
  if (!entry.end_time_utc) return true;
  const oauth = config.googleOAuth;
  if (!oauth?.refreshToken) return false;

  try {
    const sheets = createSheetsClient(oauth);
    const row = entryRowForSheets(db, entry);
    await appendEntryRow(sheets, config, row);
    db.markSynced(entry.id);
    debug('synced entry', entry.id);
    return true;
  } catch (e) {
    debug('sync failed', entry.id, e);
    return false;
  }
}
