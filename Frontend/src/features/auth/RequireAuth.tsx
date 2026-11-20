import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { isNetworkError } from "@/api/client";

import { useSession } from "./session";

/** Indicateur plein écran affiché pendant la restauration de la session. */
export function SessionLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-label="Chargement">
      <LoaderCircle className="size-8 animate-spin text-brand" aria-hidden />
    </div>
  );
}

interface RequireAuthProps {
  children: ReactNode;
  /**
   * Laisse passer quand la session ne peut pas être vérifiée faute de réseau :
   * la page s'affiche alors avec les seuls livres enregistrés sur l'appareil.
   */
  allowOffline?: boolean;
}

/**
 * N'affiche son contenu qu'à un utilisateur connecté. Un visiteur est envoyé
 * à la connexion, puis ramené à la page qu'il voulait ouvrir.
 */
export function RequireAuth({ children, allowOffline = false }: RequireAuthProps) {
  const { data: user, isPending, error } = useSession();
  const { pathname, search } = useLocation();

  if (isPending) return <SessionLoader />;
  if (allowOffline && error && isNetworkError(error)) return children;
  if (!user) return <Navigate to="/connexion" replace state={{ from: pathname + search }} />;
  return children;
}
