import { Command } from 'commander';
import { setDebug } from './logger.js';
import { cmdInit } from './cmd/init.js';
import { cmdStart } from './cmd/start.js';
import { cmdStop } from './cmd/stop.js';
import { cmdStatus } from './cmd/status.js';
import { cmdProjects } from './cmd/projects.js';
import { cmdProjectReport } from './cmd/project-report.js';
import { cmdClientReport } from './cmd/client-report.js';
import { cmdSync } from './cmd/sync-cmd.js';

export async function run(argv) {
  const raw = argv.slice(2);
  const hasDebug = raw.includes('--debug') || raw.includes('-d');
  setDebug(hasDebug);

  const program = new Command();
  program.name('tim').description('Time tracking CLI').version('1.0.0');
  program.helpOption('-h, --help');
  program.option('-d, --debug', 'verbose logging (API/SQL details on stderr)');

  program
    .command('init')
    .description('Configure Google OAuth and spreadsheet')
    .action(async () => {
      await cmdInit();
    });

  program
    .command('start')
    .description('Start a timer (interactive project pick)')
    .action(async () => {
      await cmdStart();
    });

  program
    .command('stop')
    .description('Stop the active timer')
    .action(async () => {
      await cmdStop();
    });

  program
    .command('status')
    .description('Show active timer')
    .action(async () => {
      await cmdStatus();
    });

  program
    .command('projects')
    .description('List projects')
    .action(async () => {
      await cmdProjects();
    });

  program
    .command('project')
    .description('Report time for a project')
    .argument('<name>', 'Project name (exact match)')
    .option('-w', 'current week (Monday–now, local)')
    .option('-m', 'current month (local, month start–now)')
    .action(async (name, opts) => {
      if (opts.w && opts.m) {
        console.error('Use only one of -w or -m.');
        process.exit(1);
      }
      await cmdProjectReport(name, { week: opts.w, month: opts.m });
    });

  program
    .command('client')
    .description('Report time for a client (all projects)')
    .argument('<name>', 'Client display name, or client code (e.g. TLS)')
    .option('-w', 'current week (Monday–now, local)')
    .option('-m', 'current month (local, month start–now)')
    .action(async (name, opts) => {
      if (opts.w && opts.m) {
        console.error('Use only one of -w or -m.');
        process.exit(1);
      }
      await cmdClientReport(name, { week: opts.w, month: opts.m });
    });

  program
    .command('sync')
    .description('Retry syncing unsynced entries to Google Sheets')
    .action(async () => {
      await cmdSync();
    });

  if (raw.length === 0) {
    program.outputHelp();
    process.exit(0);
  }

  await program.parseAsync(argv);
}
