import { Star } from "lucide-react";

import { formatRating } from "@/lib/format";

const MAX_STARS = 5;

/** Rangée de cinq étoiles, remplies selon la note arrondie à l'entier le plus proche. */
export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${formatRating(value)} sur 5`}>
      {Array.from({ length: MAX_STARS }, (_, index) => (
        <Star
          key={index}
          className={`size-4 ${index < Math.round(value) ? "fill-brand text-brand" : "fill-line text-line"}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** Note compacte pour une cellule de tableau : étoile, moyenne et nombre de notes. */
export function RatingSummary({ average, count }: { average: number | null; count: number }) {
  if (average === null) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Star className="size-4 fill-brand text-brand" aria-hidden />
      <span className="font-bold tabular-nums">{formatRating(average)}</span>
      <span className="text-xs text-muted">({count})</span>
    </span>
  );
}
