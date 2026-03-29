import { existsSync } from 'node:fs';
import { loadConfig } from './config.js';
import { CONFIG_PATH, DB_PATH } from './paths.js';
import { databaseExists, openDatabase } from './db.js';
import { debug as logDebug, isDebug } from './logger.js';

export function requireConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Config not found. Run \`tim init\` first (${CONFIG_PATH}).`);
  }
  const config = loadConfig();
  if (!config) {
    throw new Error(`Config not found. Run \`tim init\` first (${CONFIG_PATH}).`);
  }
  return config;
}

export function requireDb(debugLog) {
  if (!databaseExists(DB_PATH)) {
    throw new Error(`Database not found. Run \`tim init\` first (${DB_PATH}).`);
  }
  return openDatabase(DB_PATH, { debug: debugLog });
}

/** @param {(msg: string) => void} [debugLog] SQL debug logger; defaults to logger debug when --debug. */
export function openTim(debugLog) {
  const sqlLog = debugLog ?? (isDebug() ? (msg) => logDebug(msg) : undefined);
  const config = requireConfig();
  const db = requireDb(sqlLog);
  if (isDebug()) logDebug('loaded config and database');
  return { config, db, dbPath: DB_PATH, configPath: CONFIG_PATH };
}
