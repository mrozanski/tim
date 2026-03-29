#!/usr/bin/env node
import { run } from '../src/cli.js';

run(process.argv).catch((err) => {
  console.error(err.message || String(err));
  if (process.argv.includes('--debug') && err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
