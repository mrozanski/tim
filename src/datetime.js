/** Format Date as UTC `YYYY-MM-DD HH:mm:ss` per spec. */
export function formatUtc(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

export function parseUtc(s) {
  if (!s) return null;
  const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Start of local calendar day for `date`. */
export function startOfLocalDay(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** End of local calendar day (exclusive next midnight) as upper bound for overlap. */
export function endOfLocalDayExclusive(date) {
  const start = startOfLocalDay(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
}

/** Monday 00:00 local of the week containing `date`. */
export function startOfLocalWeekMonday(date) {
  const d = startOfLocalDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff, 0, 0, 0, 0);
}

export function startOfLocalMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfLocalMonthExclusive(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}

/**
 * Sum overlap between [entryStart, entryEnd] and [rangeStart, rangeEnd] in ms.
 * entryEnd may be null for running timer — treat as `now` for overlap with range.
 */
export function overlapDurationMs(entryStart, entryEnd, rangeStart, rangeEnd, now = new Date()) {
  const end = entryEnd ?? now;
  const start = Math.max(entryStart.getTime(), rangeStart.getTime());
  const fin = Math.min(end.getTime(), rangeEnd.getTime());
  return Math.max(0, fin - start);
}

export function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}

/** Wall-clock span as `hh:mm:ss` (non-negative). */
export function formatDurationHms(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * @param {{ week?: boolean, month?: boolean }} opts
 * @returns {{ rangeStart: Date, rangeEnd: Date, label: string }}
 */
export function getReportRange(opts, now = new Date()) {
  if (opts.month) {
    return { rangeStart: startOfLocalMonth(now), rangeEnd: now, label: 'this month' };
  }
  if (opts.week) {
    return { rangeStart: startOfLocalWeekMonday(now), rangeEnd: now, label: 'this week' };
  }
  return { rangeStart: startOfLocalDay(now), rangeEnd: now, label: 'today' };
}
