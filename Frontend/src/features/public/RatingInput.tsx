import { Star } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import type { CatalogBook } from "@/api/types";
import { errorMessage } from "@/api/client";
import { useToast } from "@/components/Toast";
import { useSession } from "@/features/auth/session";

import { useMyRating, useRate } from "./data";

const STARS = [1, 2, 3, 4, 5];
const LABELS = ["", "Décevant", "Moyen", "Bien", "Très bien", "Excellent"];

interface RatingInputProps {
  book: CatalogBook;
  /** Vrai si le client connecté a acheté ce livre. */
  owned: boolean;
}

/**
 * Note du client : cinq étoiles cliquables.
 * Un livre payant ne se note qu'après l'avoir acheté ; il faut être connecté dans tous les cas.
 */
export function RatingInput({ book, owned }: RatingInputProps) {
  const toast = useToast();
  const { data: user } = useSession();
  const { pathname } = useLocation();
  const allowed = Boolean(user) && (book.is_free || owned);
  const { data: mine = null } = useMyRating(book.slug, allowed);
  const rate = useRate(book.slug);
  const [hovered, setHovered] = useState(0);

  if (!allowed) {
    return (
      <p className="text-sm text-muted">
        {user ? (
          "Achetez ce livre pour pouvoir le noter."
        ) : (
          <>
            <Link to="/connexion" state={{ from: pathname }} className="font-bold text-brand-strong hover:underline">
              Connectez-vous
            </Link>{" "}
            pour noter ce livre.
          </>
        )}
      </p>
    );
  }

  const shown = hovered || mine || 0;
  const submit = (stars: number | null) =>
    rate.mutate(stars, {
      onSuccess: () => toast("success", stars ? "Merci pour votre note." : "Votre note a été retirée."),
      onError: (error) => toast("error", errorMessage(error)),
    });

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="flex" onMouseLeave={() => setHovered(0)} role="radiogroup" aria-label="Votre note">
          {STARS.map((stars) => (
            <motion.button
              key={stars}
              type="button"
              role="radio"
              aria-checked={mine === stars}
              aria-label={`${stars} étoile${stars > 1 ? "s" : ""} : ${LABELS[stars]}`}
              disabled={rate.isPending}
              onMouseEnter={() => setHovered(stars)}
              onFocus={() => setHovered(stars)}
              onBlur={() => setHovered(0)}
              onClick={() => submit(stars)}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="rounded-md p-1"
            >
              <Star
                className={`size-7 transition-colors duration-150 ${
                  stars <= shown ? "fill-brand text-brand" : "fill-line text-line"
                }`}
                aria-hidden
              />
            </motion.button>
          ))}
        </div>
        <p className="text-sm font-bold">{LABELS[shown] || "Donnez votre note"}</p>
      </div>
      {mine && (
        <button
          type="button"
          onClick={() => submit(null)}
          disabled={rate.isPending}
          className="mt-2 text-xs text-muted underline hover:text-ink"
        >
          Retirer ma note
        </button>
      )}
    </div>
  );
}
