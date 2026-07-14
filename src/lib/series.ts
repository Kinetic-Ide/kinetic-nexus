/*
 * Copyright (c) 2026 Alayra Systems Pvt. Limited (Pakistan)
 * & Alayra Systems LLC (USA).
 *
 * Alayra Nexus™ is a trademark of Alayra Systems. Use of the name or logo
 * is not granted by the software license below.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * A copy of the License is in the LICENSE file at the repository root,
 * or at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for details.
 */

// Day-bucket helpers for time series. A GROUP BY only returns days that actually have rows, so a
// quiet day simply vanishes — and a chart drawn straight from that silently compresses the gap,
// making a week with three idle days look continuous. Every series is projected onto the full
// window first, with absent days filled as zeros, so the x-axis always tells the truth.

const DAY_MS = 86_400_000;

/** The UTC dates from `since` to `until` inclusive, oldest first. */
export function dateRange(since: Date, until: Date): string[] {
  const out: string[] = [];
  const start = Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate());
  const end   = Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate());
  // Guard a reversed or absurd range rather than looping forever.
  if (end < start) return out;
  for (let t = start; t <= end; t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** The UTC dates of the last `days` days ending at `now`, oldest first. */
export function lastNDates(days: number, now: Date): string[] {
  return dateRange(new Date(now.getTime() - (days - 1) * DAY_MS), now);
}

/**
 * Project gap-prone day buckets onto a full set of dates, filling absent days via `zero`.
 * Rows outside `dates` are dropped, so the series can never be longer than the window it claims.
 */
export function fillSeries<T extends { date: string }>(rows: T[], dates: string[], zero: (date: string) => T): T[] {
  const found = new Map(rows.map((r) => [r.date, r]));
  return dates.map((date) => found.get(date) ?? zero(date));
}
