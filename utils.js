// utils.js – Shared utilities for date/time calculations

/**
 * Returns the user's local timezone identifier.
 */
export function getLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return 'UTC';
  }
}

/**
 * Formats a Date object to a human‑readable string, e.g. "MAY 15, 2024".
 */
export function formatDateLong(date) {
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString(undefined, options).toUpperCase();
}

/**
 * Returns an object describing the difference between now and a target Date.
 * All values are positive; if target is in the past, totalMs will be 0.
 */
export function getTimeDifference(targetDate) {
  const now = new Date();
  let diffMs = targetDate.getTime() - now.getTime();
  if (diffMs < 0) diffMs = 0;
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const totalHours = diffMs / (1000 * 60 * 60);
  return { totalMs: diffMs, days, hours, minutes, seconds, totalHours };
}

/**
 * Determines if a given year is a leap year.
 */
export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the start of the current year (midnight) in the local timezone.
 */
export function getStartOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
  return start;
}

/**
 * Returns the start of the next year (midnight) in the local timezone.
 */
export function getStartOfNextYear(date = new Date()) {
  const start = new Date(date.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
  return start;
}
