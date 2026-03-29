let debugEnabled = false;

export function setDebug(value) {
  debugEnabled = Boolean(value);
}

export function isDebug() {
  return debugEnabled;
}

export function debug(...args) {
  if (debugEnabled) {
    console.error('[tim]', ...args);
  }
}
