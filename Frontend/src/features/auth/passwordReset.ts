/** Réinitialisation du mot de passe : demande du lien par e-mail, puis changement. */

import { useMutation } from "@tanstack/react-query";

import { api, ApiError, errorMessage } from "@/api/client";

/** Demande l'envoi d'un lien. Réussit aussi pour une adresse inconnue, sans rien révéler. */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) =>
      api<void>("/auth/password-reset/", { method: "POST", body: { email } }),
  });
}

interface NewPassword {
  uid: string;
  token: string;
  password: string;
}

/** Enregistre le nouveau mot de passe, sur présentation du lien reçu. */
export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: (data: NewPassword) =>
      api<void>("/auth/password-reset/confirm/", { method: "POST", body: data }),
  });
}

/** Vrai si l'API a refusé le lien lui-même : inconnu, déjà utilisé ou périmé. */
export const linkRefused = (error: unknown) =>
  error instanceof ApiError && error.code === "invalid_reset_link";

/**
 * Message à montrer sous le formulaire. L'API détaille ses reproches au mot de passe
 * dans `errors.password` : ce détail est plus utile que le message général.
 */
export const passwordProblem = (error: unknown) =>
  (error instanceof ApiError && error.errors?.password?.join(" ")) || errorMessage(error);
