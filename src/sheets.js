import { parseUtc } from './datetime.js';
import { getMonthTabName, getSpreadsheetIdForYear } from './config.js';
import { debug } from './logger.js';

/**
 * Append one completed entry row (four columns) with RAW input.
 * @param {import('googleapis').sheets_v4.Sheets} sheets
 * @param {import('./config.js').TimConfig} config
 * @param {{ client_name: string, project_name?: string, start_time_utc: string, end_time_utc: string }} row
 */
export async function appendEntryRow(sheets, config, row) {
  const end = parseUtc(row.end_time_utc);
  if (!end) throw new Error('Invalid end_time_utc for sync');

  const year = end.getUTCFullYear();
  const month = end.getUTCMonth() + 1;

  const spreadsheetId = getSpreadsheetIdForYear(config, year);
  const sheetName = getMonthTabName(config, year, month);
  const range = `'${sheetName.replace(/'/g, "''")}'!A1`;

  const values = [[row.client_name, row.project_name ?? '', row.start_time_utc, row.end_time_utc]];

  debug('spreadsheets.values.append', { spreadsheetId, range, values });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

/** @param {ReturnType<import('./db.js').openDatabase>} db */
export function entryRowForSheets(db, entry) {
  const project = db.getProjectById(entry.project_id);
  const projectName = project?.name ?? '';
  return {
    client_name: entry.client_name,
    project_name: projectName,
    start_time_utc: entry.start_time_utc,
    end_time_utc: entry.end_time_utc,
  };
}
