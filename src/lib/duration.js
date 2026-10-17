const UNITS = {
  s: 1_000,
  sec: 1_000,
  secs: 1_000,
  second: 1_000,
  seconds: 1_000,
  m: 60_000,
  min: 60_000,
  mins: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
  w: 604_800_000,
  week: 604_800_000,
  weeks: 604_800_000
};

export const MAX_REMINDER_MS = 30 * 86_400_000;

export function parseDuration(input) {
  const normalized = String(input).trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (!match || !UNITS[match[2]]) return null;

  const milliseconds = Number(match[1]) * UNITS[match[2]];
  if (!Number.isFinite(milliseconds) || milliseconds < 5_000 || milliseconds > MAX_REMINDER_MS) {
    return null;
  }

  return Math.round(milliseconds);
}

export function humanizeDuration(milliseconds) {
  const units = [
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1_000]
  ];

  for (const [name, size] of units) {
    if (milliseconds >= size) {
      const amount = Math.round(milliseconds / size);
      return `${amount} ${name}${amount === 1 ? '' : 's'}`;
    }
  }

  return 'a few seconds';
}
