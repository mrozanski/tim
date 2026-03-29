import { openTim } from '../runtime.js';

export async function cmdProjects() {
  const { db } = openTim();
  const recent = db.getRecentProjects(3);
  const recentIds = new Set(recent.map((p) => p.id));
  const all = db.listProjectsOrdered();

  if (all.length === 0) {
    console.log('No projects yet. Run tim start to create one.');
    return;
  }

  console.log('Projects (recent first):');
  for (const p of all) {
    const tag = recentIds.has(p.id) ? '*' : ' ';
    console.log(`  ${tag} ${p.name} — ${p.client_name}`);
  }
}
