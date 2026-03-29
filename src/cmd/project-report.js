import {
  parseUtc,
  formatDuration,
  overlapDurationMs,
  getReportRange,
} from '../datetime.js';
import { openTim } from '../runtime.js';

/**
 * @param {string} name
 * @param {{ week?: boolean, month?: boolean }} opts
 */
export async function cmdProjectReport(name, opts) {
  const { db } = openTim();
  const project = db.findProjectByName(name);
  if (!project) {
    console.error(`Unknown project: ${name}`);
    process.exit(1);
  }

  const now = new Date();
  const { rangeStart, rangeEnd, label } = getReportRange(opts, now);

  const entries = db.listEntriesForProject(project.id);
  let totalMs = 0;

  for (const e of entries) {
    const start = parseUtc(e.start_time_utc);
    const end = e.end_time_utc ? parseUtc(e.end_time_utc) : null;
    if (!start) continue;
    totalMs += overlapDurationMs(start, end, rangeStart, rangeEnd, now);
  }

  console.log(`${project.name}: ${formatDuration(totalMs)} ${label}.`);
}
