import { JourneyResult, JourneyLeg } from '@/lib/types';
import { PRODUCT_COLORS } from '@/constants';

function LinePill({ leg }: { leg: JourneyLeg }) {
  if (leg.mode === 'walk') {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
        🚶 {leg.durationMinutes}min
      </span>
    );
  }
  const color = PRODUCT_COLORS[leg.mode] ?? '#888';
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {leg.lineName ?? leg.mode}
    </span>
  );
}

export function JourneyResultView({ journey }: { journey: JourneyResult }) {
  const transitLegs = journey.legs.filter((l) => l.mode !== 'walk');

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-gray-800">
          <span className="text-lg">🕐</span>
          <span className="text-lg font-bold">{journey.durationMinutes} min</span>
        </div>
        {journey.transfers === 0 ? (
          <span className="text-xs text-green-600 font-medium">Direkt</span>
        ) : (
          <span className="text-xs text-gray-500">{journey.transfers} Umstieg{journey.transfers > 1 ? 'e' : ''}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {transitLegs.map((leg, i) => (
          <LinePill key={i} leg={leg} />
        ))}
      </div>
    </div>
  );
}
