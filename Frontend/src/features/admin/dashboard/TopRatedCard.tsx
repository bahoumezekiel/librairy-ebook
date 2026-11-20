import { Star } from "lucide-react";

import type { TopRatedBook } from "@/api/types";
import { Card, CardHeader } from "@/components/Card";
import { Stars } from "@/components/Stars";
import { formatRating } from "@/lib/format";

/** Classement des livres selon la note moyenne donnée par les clients. */
export function TopRatedCard({ books }: { books: TopRatedBook[] }) {
  return (
    <Card>
      <CardHeader
        title="Livres les mieux notés"
        legend="Note moyenne sur 5 étoiles, depuis le lancement"
      />
      {books.length === 0 ? (
        <div className="grid place-items-center py-10 text-center">
          <Star className="size-8 text-muted" aria-hidden />
          <p className="mt-3 text-sm text-muted">Aucune note pour le moment.</p>
        </div>
      ) : (
        <ol className="space-y-5">
          {books.map((book, index) => (
            <li key={book.slug} className="flex items-center gap-4">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                  index === 0 ? "bg-brand-soft text-brand-strong" : "bg-canvas text-muted"
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{book.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Stars value={book.rating_average} />
                  <span className="text-xs text-muted">
                    {book.rating_count} {book.rating_count > 1 ? "notes" : "note"}
                  </span>
                </div>
              </div>
              <p className="shrink-0 text-lg font-bold tabular-nums">
                {formatRating(book.rating_average)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
