import { CommuteDestination } from '@/lib/types';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Sets one destination's weight and proportionally shrinks/grows the others so the total
 * weight budget stays constant — e.g. dragging one destination's slider up takes weight away
 * from the others in proportion to their current share, instead of just leaving them as-is.
 *
 * If the other destinations hit the 1..100 bounds before fully absorbing the change (e.g. all
 * already at the floor), the requested destination's weight is capped accordingly so the total
 * really does stay constant rather than silently growing the overall budget.
 */
export function redistributeWeights(
  destinations: CommuteDestination[],
  changedId: string,
  requestedWeight: number,
): CommuteDestination[] {
  const changed = destinations.find((d) => d.id === changedId);
  const others = destinations.filter((d) => d.id !== changedId);
  const newWeight = clamp(requestedWeight, 1, 100);

  if (!changed || others.length === 0) {
    return destinations.map((d) => (d.id === changedId ? { ...d, weight: newWeight } : d));
  }

  // Positive: others must collectively give up this much weight. Negative: they gain it back.
  let remainder = newWeight - changed.weight;
  const pool = others.map((d) => ({ id: d.id, weight: d.weight }));

  while (remainder !== 0) {
    const flexible = pool.filter((p) => (remainder > 0 ? p.weight > 1 : p.weight < 100));
    if (flexible.length === 0) break;

    const flexTotal = flexible.reduce((sum, p) => sum + p.weight, 0);
    let appliedThisRound = 0;
    for (const p of flexible) {
      const share = (remainder * p.weight) / flexTotal;
      const target = clamp(p.weight - share, 1, 100);
      appliedThisRound += p.weight - target;
      p.weight = target;
    }
    remainder -= appliedThisRound;
    if (Math.abs(appliedThisRound) < 0.001) break; // rounding floor — nothing more to give
  }

  const finalNewWeight = clamp(newWeight - remainder, 1, 100);

  return destinations.map((d) => {
    if (d.id === changedId) return { ...d, weight: Math.round(finalNewWeight) };
    const p = pool.find((x) => x.id === d.id);
    return p ? { ...d, weight: Math.round(p.weight) } : d;
  });
}
