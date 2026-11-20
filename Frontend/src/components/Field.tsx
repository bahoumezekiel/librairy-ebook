import type { ReactNode } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "@/api/client";

/** Style commun des champs de saisie (input, select, textarea). */
export const INPUT_CLASS =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm placeholder:text-muted/70 aria-invalid:border-danger";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  /** Précision affichée sous le champ quand il n'y a pas d'erreur. */
  hint?: string;
  children: ReactNode;
}

/** Champ de formulaire : libellé, saisie, puis message d'erreur ou précision. */
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-bold">
        {label}
      </label>
      {children}
      {error ? (
        // `aria-live` : le message est lu dès son apparition, sans avoir à revenir au champ.
        <p className="mt-2 text-sm text-danger" aria-live="polite">
          {error}
        </p>
      ) : (
        hint && <p className="mt-2 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

/**
 * Reporte sur les champs du formulaire les erreurs de validation renvoyées par l'API.
 * Renvoie le message à afficher globalement.
 */
export function applyApiErrors<T extends FieldValues>(error: Error, setError: UseFormSetError<T>) {
  if (!(error instanceof ApiError)) return "Connexion au serveur impossible. Réessayez.";
  for (const [field, messages] of Object.entries(error.errors ?? {})) {
    setError(field as Path<T>, { message: messages[0] });
  }
  return error.message;
}
