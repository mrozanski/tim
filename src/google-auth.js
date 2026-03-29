import http from 'node:http';
import { URL } from 'node:url';
import { google } from 'googleapis';
import open from 'open';
import { debug } from './logger.js';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** Must match an authorized redirect URI in Google Cloud OAuth client settings. */
const OAUTH_LOOPBACK_PORT = 8765;

/**
 * Run browser OAuth and return tokens (includes refresh_token when prompt=consent).
 * @param {{ clientId: string, clientSecret: string }} creds
 */
export async function runOAuthInteractive(creds) {
  const { clientId, clientSecret } = creds;

  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', (err) => {
      const e = /** @type {NodeJS.ErrnoException} */ (err);
      if (e.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Port ${OAUTH_LOOPBACK_PORT} is in use (OAuth callback). Stop the other process or free that port.`,
          ),
        );
      } else {
        reject(err);
      }
    });
    server.listen(OAUTH_LOOPBACK_PORT, '127.0.0.1', resolve);
  });

  const port = OAUTH_LOOPBACK_PORT;
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [SHEETS_SCOPE],
  });

  const tokensPromise = new Promise((resolve, reject) => {
    server.once('request', (req, res) => {
      const u = new URL(req.url ?? '/', `http://127.0.0.1:${String(port)}`);
      if (u.pathname !== '/oauth2callback') {
        res.writeHead(404);
        res.end();
        return;
      }
      const err = u.searchParams.get('error');
      const code = u.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<p>Authorization complete. You can close this window and return to the terminal.</p>',
      );
      server.close();
      if (err) {
        reject(new Error(err));
        return;
      }
      if (!code) {
        reject(new Error('No authorization code received.'));
        return;
      }
      resolve(code);
    });
  });

  debug('Opening browser for Google OAuth');
  await open(authUrl);

  const code = await tokensPromise;
  const { tokens } = await oauth2Client.getToken(code);
  debug('Received OAuth tokens');
  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh token received. Try revoking tim access in Google Account settings and run tim init again.',
    );
  }
  return {
    refreshToken: tokens.refresh_token,
    clientId,
    clientSecret,
  };
}

/** @param {{ clientId: string, clientSecret: string, refreshToken: string }} oauth */
export function createSheetsClient(oauth) {
  const oauth2Client = new google.auth.OAuth2(oauth.clientId, oauth.clientSecret);
  oauth2Client.setCredentials({ refresh_token: oauth.refreshToken });
  return google.sheets({ version: 'v4', auth: oauth2Client });
}
