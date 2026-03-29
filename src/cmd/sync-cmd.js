import { openTim } from '../runtime.js';
import { syncUnsyncedEntries } from '../sync.js';

export async function cmdSync() {
  const { config, db } = openTim();

  const result = await syncUnsyncedEntries(db, config);
  if (result.total === 0) {
    console.log('Nothing to sync.');
    return;
  }
  console.log(`Synced ${result.ok} of ${result.total} entr${result.total === 1 ? 'y' : 'ies'}.`);
  if (result.failed > 0) {
    console.warn(`${result.failed} entr${result.failed === 1 ? 'y' : 'ies'} still unsynced.`);
    process.exit(1);
  }
}
