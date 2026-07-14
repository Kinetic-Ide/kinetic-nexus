import { describe, it, expect } from 'vitest';
import { dateRange, lastNDates, fillSeries } from './series';

const d = (s: string) => new Date(`${s}T12:00:00.000Z`);

describe('dateRange', () => {
  it('lists every UTC date from since to until, inclusive and oldest first', () => {
    expect(dateRange(d('2026-07-01'), d('2026-07-04')))
      .toEqual(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']);
  });

  it('returns a single day when since and until fall on the same date', () => {
    expect(dateRange(d('2026-07-01'), d('2026-07-01'))).toEqual(['2026-07-01']);
  });

  it('returns nothing for a reversed range rather than looping', () => {
    expect(dateRange(d('2026-07-04'), d('2026-07-01'))).toEqual([]);
  });

  it('crosses a month boundary', () => {
    expect(dateRange(d('2026-06-30'), d('2026-07-01'))).toEqual(['2026-06-30', '2026-07-01']);
  });
});

describe('lastNDates', () => {
  it('ends at now and runs back n days, oldest first', () => {
    expect(lastNDates(3, d('2026-07-14'))).toEqual(['2026-07-12', '2026-07-13', '2026-07-14']);
  });
});

describe('fillSeries', () => {
  const zero = (date: string) => ({ date, requests: 0 });

  it('fills absent days with zeros so a quiet day is not silently compressed away', () => {
    const rows = [{ date: '2026-07-02', requests: 5 }];
    expect(fillSeries(rows, ['2026-07-01', '2026-07-02', '2026-07-03'], zero)).toEqual([
      { date: '2026-07-01', requests: 0 },
      { date: '2026-07-02', requests: 5 },
      { date: '2026-07-03', requests: 0 },
    ]);
  });

  it('drops rows outside the window, so a series can never outgrow the range it claims', () => {
    const rows = [{ date: '2026-06-01', requests: 9 }, { date: '2026-07-01', requests: 1 }];
    expect(fillSeries(rows, ['2026-07-01'], zero)).toEqual([{ date: '2026-07-01', requests: 1 }]);
  });
});
