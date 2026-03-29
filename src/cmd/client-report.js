import {
  parseUtc,
  formatDuration,
  overlapDurationMs,
  getReportRange,
} from '../datetime.js';
import { openTim } from '../runtime.js';

/**
 * @param {string} arg Client display name or code (see resolveClientForReport)
 * @param {{ week?: boolean, month?: boolean }} opts
 */
export async function cmdClientReport(arg, opts) {
  const { db } = openTim();

  const resolved = db.resolveClientForReport(arg);
  if (!resolved) {
    console.error(`Unknown client: ${arg}`);
    process.exit(1);
  }

  const now = new Date();
  const { rangeStart, rangeEnd, label } = getReportRange(opts, now);

  const entries = db.listEntriesForClient(resolved.displayName);
  let totalMs = 0;

  for (const e of entries) {
    const start = parseUtc(e.start_time_utc);
    const end = e.end_time_utc ? parseUtc(e.end_time_utc) : null;
    if (!start) continue;
    totalMs += overlapDurationMs(start, end, rangeStart, rangeEnd, now);
  }

  console.log(`${resolved.displayName}: ${formatDuration(totalMs)} ${label}.`);
}
