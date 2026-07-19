import { useMemo, useState } from 'preact/hooks';
import { clsx } from 'clsx';
import { Search, Check, X } from 'lucide-preact';
import { Input } from '../../ui';
import type { FetchedModel } from '../../api';
import s from '../pages.module.css';

// The model picker (P7.16). A fetch used to dump every model — 339 for OpenRouter — into the
// selection, and the only control was deleting them one by one. This flips it to opt-IN: nothing
// is selected until the operator says so, a search narrows the list, and the selection reads back
// as a compact strip (4 chips, then "+N more") instead of a wall. Controlled component: the dialog
// owns `selected` because saving needs it.

/** Every whitespace-separated token must appear somewhere in id+name — so "4o mini" finds
 *  gpt-4o-mini without a fuzzy-match dependency. */
function matches(m: FetchedModel, query: string): boolean {
  const hay = `${m.id} ${m.name ?? ''}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

const money = (n: number) => `$${parseFloat(n.toFixed(4))}`;
const ctx   = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k ctx` : `${n} ctx`);

const COLLAPSED_CHIPS = 4;

export function ModelPicker({ models, selected, onChange }: {
  models: FetchedModel[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => models.filter((m) => matches(m, query)), [models, query]);
  const chosen = new Set(selected);

  const toggle = (id: string) =>
    onChange(chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const unselectedShown = filtered.filter((m) => !chosen.has(m.id));
  const selectAllShown = () => onChange([...selected, ...unselectedShown.map((m) => m.id)]);

  const showStrip  = selected.length > 0;
  const overflow   = selected.length - COLLAPSED_CHIPS;
  // Deselecting back to ≤4 chips auto-collapses — "expanded" only means anything with overflow.
  const isExpanded = expanded && overflow > 0;
  const stripIds   = isExpanded || overflow <= 0 ? selected : selected.slice(0, COLLAPSED_CHIPS);

  return (
    <div class={s.pick}>
      <div class={s.pickSearchRow}>
        <div class={s.pickSearchWrap}>
          <Search size={13} class={s.pickSearchIcon} />
          <Input
            value={query}
            placeholder="Search models…"
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              // Enter must never reach the dialog's hidden submit; Escape clears the search.
              if (e.key === 'Enter') e.preventDefault();
              if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); }
            }}
            aria-label="Search models"
          />
        </div>
        <span class={s.pickCount}>{filtered.length} of {models.length}</span>
      </div>

      {(unselectedShown.length > 0 || selected.length > 0) && (
        <div class={s.pickBulkRow}>
          {unselectedShown.length > 0 && (
            <button type="button" class={s.pickBulkBtn} onClick={selectAllShown}>
              Select all {unselectedShown.length} shown
            </button>
          )}
          {selected.length > 0 && (
            <button type="button" class={s.pickBulkBtn} onClick={() => { onChange([]); setExpanded(false); }}>
              Clear ({selected.length})
            </button>
          )}
        </div>
      )}

      <div class={s.pickList} role="group" aria-label="Available models">
        {filtered.length === 0 && <div class={s.pickEmpty}>No model matches “{query}”</div>}
        {filtered.map((m) => {
          const on = chosen.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              class={clsx(s.pickRow, on && s.pickRowOn)}
              aria-pressed={on}
              onClick={() => toggle(m.id)}
            >
              <span class={clsx(s.pickTick, on && s.pickTickOn)}>{on && <Check size={11} />}</span>
              <span class={s.pickMain}>
                <span class={s.pickId}>{m.id}</span>
                {m.name && m.name !== m.id && <span class={s.pickName}>{m.name}</span>}
              </span>
              <span class={s.pickMeta}>
                {m.inputCostPer1M !== undefined && m.outputCostPer1M !== undefined && (
                  <span>{money(m.inputCostPer1M)} / {money(m.outputCostPer1M)}</span>
                )}
                {m.contextWindow !== undefined && <span>{ctx(m.contextWindow)}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {showStrip && (
        <div class={clsx(s.pickStrip, isExpanded && s.pickStripExpanded)}>
          {stripIds.map((id) => (
            <span key={id} class={s.modelChip}>
              <span>{id}</span>
              <button type="button" onClick={() => toggle(id)} aria-label={`Deselect ${id}`}>
                <X size={11} />
              </button>
            </span>
          ))}
          {overflow > 0 && !isExpanded && (
            <button type="button" class={s.pickMoreChip} onClick={() => setExpanded(true)}>
              +{overflow} more
            </button>
          )}
          {isExpanded && (
            <button type="button" class={s.pickMoreChip} onClick={() => setExpanded(false)}>
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}
