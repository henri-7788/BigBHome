import { Destination, ListingResult } from '@/lib/types';
import { ListingCard } from './ListingCard';

interface Props {
  listings: ListingResult[];
  destinations: Destination[];
  onRemove: (id: string) => void;
  onToggleFavorite: (id: string, newValue: boolean) => void;
  onToggleComparison: (id: string) => void;
  onRetryJourney: (id: string) => void;
  onRetryDestinationJourney: (listingId: string, destinationId: string) => Promise<void>;
  onToggleOffline: (id: string, newValue: boolean) => void;
}

export function ListingGrid({ listings, destinations, onRemove, onToggleFavorite, onToggleComparison, onRetryJourney, onRetryDestinationJourney, onToggleOffline }: Props) {
  if (!listings.length) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((result) => (
        <ListingCard
          key={result.id}
          result={result}
          destinations={destinations}
          onRemove={onRemove}
          onToggleFavorite={onToggleFavorite}
          onToggleComparison={onToggleComparison}
          onRetryJourney={onRetryJourney}
          onRetryDestinationJourney={onRetryDestinationJourney}
          onToggleOffline={onToggleOffline}
        />
      ))}
    </div>
  );
}
