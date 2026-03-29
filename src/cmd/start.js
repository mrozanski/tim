import { select, input } from '@inquirer/prompts';
import { formatUtc } from '../datetime.js';
import { openTim } from '../runtime.js';
import { trySyncEntry } from '../sync.js';
import { isValidClientCode, normalizeClientCode } from '../client-code.js';

export async function cmdStart() {
  if (!process.stdin.isTTY) {
    console.error(
      'tim start requires an interactive terminal. Use the terminal for now; a non-interactive start is planned.',
    );
    process.exit(1);
  }

  const { config, db } = openTim();

  const recent = db.getRecentProjects(3);
  const firstChoices = [
    ...recent.map((p) => ({
      name: `${p.name} (${p.client_name})`,
      value: { type: 'project', id: p.id },
    })),
    { name: 'More…', value: { type: 'more' } },
  ];

  let picked = await select({
    message: 'Start timer for',
    choices: firstChoices,
  });

  if (picked.type === 'more') {
    const all = db.listProjectsOrdered();
    const moreChoices = [
      ...all.map((p) => ({
        name: `${p.name} (${p.client_name})`,
        value: { type: 'project', id: p.id },
      })),
      { name: 'Create new project', value: { type: 'create' } },
    ];
    if (moreChoices.length === 1) {
      picked = { type: 'create' };
    } else {
      picked = await select({
        message: 'Choose project',
        choices: moreChoices,
      });
    }
  }

  let projectId;
  let projectName;
  let clientName;

  if (picked.type === 'create') {
    const clients = db.listClientsOrdered();
    const clientChoices = [
      ...clients.map((c) => ({
        name:
          c.code != null && c.code !== ''
            ? `${c.display_name} (${c.code})`
            : `${c.display_name} (no code)`,
        value: { type: 'pick', id: c.id },
      })),
      { name: 'New client', value: { type: 'new' } },
    ];

    const clientPick = await select({
      message: 'Client',
      choices: clientChoices,
    });

    /** @type {{ id: number, display_name: string, code: string | null }} */
    let clientRow;

    if (clientPick.type === 'new') {
      const displayName = await input({
        message: 'Client display name (for Sheets)',
        validate: (v) => (v?.trim() ? true : 'Display name is required.'),
      });
      const codeRaw = await input({
        message: 'Client code (2–5 letters/digits, e.g. TLS)',
        validate: (v) => {
          if (!v?.trim()) return 'Code is required.';
          if (!isValidClientCode(v)) return 'Use 2–5 uppercase letters or digits (A–Z, 0–9).';
          if (db.findClientByCode(v)) return 'That code is already in use.';
          return true;
        },
      });
      if (db.findClientByDisplayName(displayName.trim())) {
        console.error('A client with that display name already exists.');
        process.exit(1);
      }
      try {
        const created = db.insertClient(displayName.trim(), codeRaw);
        clientRow = { id: created.id, display_name: displayName.trim(), code: normalizeClientCode(codeRaw) };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('UNIQUE') || msg.includes('unique')) {
          console.error('That client name or code already exists.');
          process.exit(1);
        }
        throw e;
      }
    } else {
      const row = db.getClientById(clientPick.id);
      if (!row) {
        console.error('Client not found.');
        process.exit(1);
      }
      clientRow = {
        id: row.id,
        display_name: row.display_name,
        code: row.code,
      };
    }

    if (clientRow.code) {
      const suffix = await input({
        message: `Project suffix (project name will be ${clientRow.code}-<suffix>)`,
        validate: (v) => (v?.trim() ? true : 'Suffix is required.'),
      });
      projectName = `${clientRow.code}-${suffix.trim()}`;
    } else {
      projectName = await input({
        message: 'Project name (full name; this client has no code yet)',
        validate: (v) => (v?.trim() ? true : 'Project name is required.'),
      });
      projectName = projectName.trim();
    }

    try {
      const created = db.insertProject(projectName, clientRow.display_name, clientRow.id);
      projectId = created.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') || msg.includes('unique')) {
        console.error('A project with that name already exists.');
        process.exit(1);
      }
      throw e;
    }
    clientName = clientRow.display_name;
  } else {
    const p = db.getProjectById(picked.id);
    if (!p) {
      console.error('Project not found.');
      process.exit(1);
    }
    projectId = p.id;
    projectName = p.name;
    clientName = p.client_name;
  }

  const active = db.getActiveEntry();
  const now = new Date();
  const nowUtc = formatUtc(now);

  if (active) {
    const prevProject = db.getProjectById(active.project_id);
    const prevName = prevProject?.name ?? '?';
    db.closeEntry(active.id, nowUtc);
    const closed = { ...active, end_time_utc: nowUtc };
    const synced = await trySyncEntry(db, config, closed);
    if (!synced) {
      console.warn('Could not sync to Google Sheets; entry will remain queued.');
    }
    console.log(`Stopped timer on ${prevName}.`);
  }

  db.insertOpenEntry(projectId, clientName);
  db.touchProject(projectId);
  console.log(`Started timer on ${projectName}.`);
}
