export type Counters = {
  created: number;
  updated: number;
  skipped: number;
};

export type UpsertResult = keyof Counters;

export function emptyCounters(): Counters {
  return { created: 0, updated: 0, skipped: 0 };
}
