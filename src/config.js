import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { CONFIG_PATH, TIM_DIR } from './paths.js';

/** @typedef {{
 *   currentYear: number,
 *   years: Record<string, { spreadsheetId: string, monthTabs?: Record<string, string> }>,
 *   googleOAuth: { clientId: string, clientSecret: string, refreshToken: string }
 * }} TimConfig */

const DEFAULT_MONTH_TABS = Object.fromEntries(
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
    (name, i) => [String(i + 1), name],
  ),
);

export function defaultMonthTabs() {
  return { ...DEFAULT_MONTH_TABS };
}

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }
  const raw = readFileSync(CONFIG_PATH, 'utf8');
  return /** @type {TimConfig} */ (JSON.parse(raw));
}

/** @param {TimConfig} config */
export function saveConfig(config) {
  mkdirSync(TIM_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

/** @param {TimConfig} config */
export function ensureYearEntry(config, year) {
  const y = String(year);
  if (!config.years[y]) {
    throw new Error(`No spreadsheet configured for year ${year}. Update ~/.tim/config.json or run tim init.`);
  }
  if (!config.years[y].monthTabs) {
    config.years[y].monthTabs = defaultMonthTabs();
  }
}

/** @param {TimConfig} config */
export function getSpreadsheetIdForYear(config, year) {
  ensureYearEntry(config, year);
  return config.years[String(year)].spreadsheetId;
}

/** @param {TimConfig} config */
export function getMonthTabName(config, year, month1to12) {
  ensureYearEntry(config, year);
  const tabs = config.years[String(year)].monthTabs ?? defaultMonthTabs();
  const key = String(month1to12);
  return tabs[key] ?? DEFAULT_MONTH_TABS[key] ?? `M${month1to12}`;
}
