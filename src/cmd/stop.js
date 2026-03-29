import { formatUtc } from '../datetime.js';
import { openTim } from '../runtime.js';
import { trySyncEntry } from '../sync.js';

export async function cmdStop() {
  const { config, db } = openTim();

  const active = db.getActiveEntry();
  if (!active) {
    console.log('No active timer.');
    return;
  }

  const project = db.getProjectById(active.project_id);
  const name = project?.name ?? '?';
  const nowUtc = formatUtc(new Date());

  db.closeEntry(active.id, nowUtc);
  const closed = { ...active, end_time_utc: nowUtc };

  const synced = await trySyncEntry(db, config, closed);
  if (!synced) {
    console.warn('Could not sync to Google Sheets; entry will remain queued.');
  }

  console.log(`Stopped timer on ${name}.`);
}
