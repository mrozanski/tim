import { parseUtc, formatDuration } from '../datetime.js';
import { openTim } from '../runtime.js';

export async function cmdStatus() {
  const { db } = openTim();

  const active = db.getActiveEntry();
  if (!active) {
    console.log('No active timer.');
    return;
  }

  const project = db.getProjectById(active.project_id);
  const name = project?.name ?? '?';
  const start = parseUtc(active.start_time_utc);
  if (!start) {
    console.log(`Timer running on ${name} (invalid start time).`);
    return;
  }

  const elapsed = Date.now() - start.getTime();
  console.log(`${name}: ${formatDuration(elapsed)} elapsed (since ${active.start_time_utc} UTC).`);
}
