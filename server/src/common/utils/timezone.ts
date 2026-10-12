import { APP_TIMEZONE, RETROACTIVE_DAYS_LIMIT } from '../constants';

/**
 * Returns a comparable timestamp treating America/Sao_Paulo wall-clock as UTC.
 * Used only for retroactive-window comparisons, not for storage.
 */
export function toAppTimezoneTimestamp(date: Date): number {
  const formatted = date.toLocaleString('sv-SE', { timeZone: APP_TIMEZONE });
  return new Date(`${formatted}Z`).getTime();
}

export function isWithinRetroactiveWindow(startedAt: Date, now: Date = new Date()): boolean {
  const startedTs = toAppTimezoneTimestamp(startedAt);
  const nowTs = toAppTimezoneTimestamp(now);
  const minTs = nowTs - RETROACTIVE_DAYS_LIMIT * 24 * 60 * 60 * 1000;
  return startedTs >= minTs && startedTs <= nowTs;
}

export function toIsoUtc(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  return date.toISOString();
}
