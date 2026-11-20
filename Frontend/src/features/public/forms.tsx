/** Éléments de formulaire de l'espace public : angles droits, sans icône. */

import type { ReactNode } from "react";

/** Champ sur fond blanc. */
export const FIELD =
  "h-12 w-full border border-line bg-white px-4 text-sm text-ink transition-colors duration-150 placeholder:text-muted/70 hover:border-muted/50 focus:border-ink focus:outline-none aria-invalid:border-danger";

/** Champ sur fond bleu nuit. */
export const FIELD_ON_DARK =
  "h-13 w-full border border-white/25 bg-white/5 px-5 text-base text-white transition-colors duration-150 placeholder:text-white/50 hover:border-white/45 focus:border-brand focus:outline-none aria-invalid:border-danger";

/** Bouton principal : orange, texte bleu nuit, angles droits. */
export const SQUARE_BUTTON =
  "inline-flex h-13 items-center justify-center bg-brand px-8 text-sm font-bold text-ink transition-colors duration-150 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60";

interface LabelledFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  /** Mention affichée à droite du libellé (par exemple un compteur). */
  aside?: ReactNode;
  children: ReactNode;
}

/** Libellé en petites capitales au-dessus du champ, erreur en dessous. */
export function LabelledField({ label, htmlFor, error, aside, children }: LabelledFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <label htmlFor={htmlFor} className="text-xs font-bold uppercase tracking-[0.14em] text-ink">
          {label}
        </label>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </div>
      {children}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
