import { PiggyBank } from 'lucide-preact';
import { Card, LineChart } from '../../ui';
import { currency, compactNumber, shortDate } from '../../lib/format';
import type { AnalyticsOverview } from '../../api';
import s from '../pages.module.css';

// What the response cache actually saved. A cached request never reached the provider, so it cost
// nothing — and the gateway now records what calling the provider *would* have cost, which is the
// only reason this number can exist at all. When nothing has been served from cache the card says
// so plainly rather than showing a proud $0.
export function CacheSavings({ data }: { data: AnalyticsOverview }) {
  const { totals, byDay } = data;
  const hasHits = totals.cacheHits > 0;

  return (
    <Card heading="Response cache" class={s.saveCard}>
      <div class={s.saveTop}>
        <div class={s.saveFigure}>
          <span class={s.saveIcon}><PiggyBank size={16} /></span>
          <div>
            <div class={s.saveBig}>{currency(totals.cacheSavedUsd)}</div>
            <div class={s.saveSub}>saved in this window</div>
          </div>
        </div>
        <div class={s.saveStats}>
          <div>
            <div class={s.saveStatVal}>{compactNumber(totals.cacheHits)}</div>
            <div class={s.saveStatLbl}>served from cache</div>
          </div>
          <div>
            <div class={s.saveStatVal}>{(totals.cacheHitRate * 100).toFixed(1)}%</div>
            <div class={s.saveStatLbl}>hit rate</div>
          </div>
        </div>
      </div>

      {hasHits ? (
        <LineChart
          data={byDay.map((d) => d.savedUsd)}
          labels={byDay.map((d) => shortDate(d.date))}
          format={currency}
          accent="var(--green)"
          height={92}
          ariaLabel="Money saved by the response cache, per day"
        />
      ) : (
        <p class={s.saveEmpty}>
          Nothing has been served from cache in this window, so there is nothing to save yet. The
          response cache is off until an operator turns it on in Settings.
        </p>
      )}
    </Card>
  );
}
