import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";

import type { CatalogBook } from "@/api/types";
import { fadeUp } from "@/components/motion";
import { RatingSummary } from "@/components/Stars";
import { formatMoney } from "@/lib/format";

const NEW_FOR_DAYS = 14;
const LABEL = "text-xs font-bold uppercase tracking-[0.18em]";

/** Vrai si le livre a été publié il y a moins de deux semaines. */
export const isNew = (publishedAt: string) =>
  Date.now() - new Date(publishedAt).getTime() < NEW_FOR_DAYS * 24 * 3600 * 1000;

/** Prix d'un livre, ou étiquette verte « Gratuit ». */
export function PriceTag({ price, className = "" }: { price: number | null; className?: string }) {
  return price === null ? (
    <span className={`bg-leaf-soft px-2.5 py-1 text-leaf-strong ${LABEL} ${className}`}>Gratuit</span>
  ) : (
    <span className={`font-bold tabular-nums ${className}`}>{formatMoney(price)}</span>
  );
}

/**
 * Carte d'un livre : couverture, étiquette orange de catégorie posée sur l'image,
 * puis auteur, titre, prix et note. Au survol, l'image zoome et une flèche apparaît.
 */
export function BookCard({ book }: { book: CatalogBook }) {
  return (
    <motion.article variants={fadeUp} layout className="h-full">
      <Link
        to={`/livres/${book.slug}`}
        className="group flex h-full flex-col border border-line bg-white transition-shadow duration-300 hover:shadow-lift"
      >
        {/* 2:3, la proportion attendue des couvertures (1000 × 1500, voir le README) :
            elles remplissent le cadre exactement, sans bande ni rognage. */}
        <div className="relative aspect-2/3 overflow-hidden bg-line">
          <img
            src={book.cover}
            alt={`Couverture de ${book.title}`}
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {isNew(book.published_at) && (
            <span className={`absolute left-0 top-0 bg-ink px-3 py-2 text-white ${LABEL}`}>Nouveau</span>
          )}
          <span
            className="absolute right-0 top-1/2 grid size-12 -translate-y-1/2 translate-x-full place-items-center bg-brand text-ink transition-transform duration-300 group-hover:translate-x-0"
            aria-hidden
          >
            <ArrowRight className="size-5" />
          </span>
        </div>

        <div className="flex flex-1 flex-col p-6">
          {/* Sous l'image, et non posée dessus : elle y masquait le bas des couvertures. */}
          <span className={`w-fit max-w-full truncate bg-brand px-3 py-1.5 text-ink ${LABEL}`}>
            {book.category.name}
          </span>
          <p className={`mt-4 truncate text-muted ${LABEL}`}>{book.author}</p>
          <h3 className="mt-3 line-clamp-2 text-lg font-bold leading-snug decoration-brand decoration-2 underline-offset-4 group-hover:underline">
            {book.title}
          </h3>
          <div className="mt-auto flex items-center justify-between gap-3 pt-6 text-sm">
            <PriceTag price={book.price} />
            <RatingSummary average={book.rating_average} count={book.rating_count} />
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

/** Carte grise animée, affichée pendant le chargement d'une grille de livres. */
export function BookCardSkeleton() {
  return (
    <div className="border border-line bg-white" aria-hidden>
      <div className="aspect-2/3 animate-pulse bg-line/70" />
      <div className="space-y-3 p-6">
        <div className="h-3 w-1/3 animate-pulse bg-line/70" />
        <div className="h-5 w-4/5 animate-pulse bg-line/70" />
        <div className="h-4 w-1/2 animate-pulse bg-line/70" />
      </div>
    </div>
  );
}

/**
 * Grille de livres : jusqu'à cinq cartes par rangée sur grand écran.
 *
 * Une carte plus étroite est aussi plus courte, puisque la couverture garde sa proportion :
 * la rangée tient dans l'écran sans qu'on ait à rapetisser les images.
 */
export const BOOK_GRID = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5";
