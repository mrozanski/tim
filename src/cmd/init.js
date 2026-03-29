import { mkdirSync } from 'node:fs';
import { input, password } from '@inquirer/prompts';
import { TIM_DIR, DB_PATH } from '../paths.js';
import { loadConfig, saveConfig, defaultMonthTabs } from '../config.js';
import { runOAuthInteractive } from '../google-auth.js';
import { openDatabase } from '../db.js';
import { debug } from '../logger.js';

const ENV_CLIENT_ID = 'TIM_GOOGLE_CLIENT_ID';
const ENV_CLIENT_SECRET = 'TIM_GOOGLE_CLIENT_SECRET';

export async function cmdInit() {
  mkdirSync(TIM_DIR, { recursive: true });

  const spreadsheetId = await input({
    message: 'Google Sheets spreadsheet ID for the current year',
    validate: (v) => (v?.trim() ? true : 'Spreadsheet ID is required.'),
  });

  let clientId = process.env[ENV_CLIENT_ID]?.trim() ?? '';
  let clientSecret = process.env[ENV_CLIENT_SECRET]?.trim() ?? '';

  if (!clientId) {
    clientId = await input({
      message: `OAuth client ID (or set ${ENV_CLIENT_ID})`,
      validate: (v) => (v?.trim() ? true : 'Client ID is required.'),
    });
  }
  if (!clientSecret) {
    clientSecret = await password({
      message: `OAuth client secret (or set ${ENV_CLIENT_SECRET})`,
      mask: '*',
      validate: (v) => (v?.trim() ? true : 'Client secret is required.'),
    });
  }

  const year = new Date().getFullYear();
  console.log(
    'OAuth: Web client — add http://127.0.0.1:8765/oauth2callback under Authorized redirect URIs (not JavaScript origins).',
  );
  const oauth = await runOAuthInteractive({ clientId, clientSecret });

  const prev = loadConfig();

  /** @type {import('../config.js').TimConfig} */
  const config = {
    currentYear: year,
    years: {
      ...(prev?.years ?? {}),
      [String(year)]: {
        spreadsheetId: spreadsheetId.trim(),
        monthTabs: prev?.years?.[String(year)]?.monthTabs ?? defaultMonthTabs(),
      },
    },
    googleOAuth: {
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
      refreshToken: oauth.refreshToken,
    },
  };

  saveConfig(config);
  debug('wrote config');

  openDatabase(DB_PATH, { debug: (msg) => debug(msg) });
  console.log(`Initialized tim. Config: ~/.tim/config.json, database: ${DB_PATH}`);
}
