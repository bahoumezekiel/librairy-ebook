import { LoaderCircle, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { Button } from "@/components/Button";

import { useLogout, useSession } from "./session";

/** N'affiche son contenu qu'à l'administrateur connecté. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useSession();
  const logout = useLogout();

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center" role="status" aria-label="Chargement">
        <LoaderCircle className="size-8 animate-spin text-brand" aria-hidden />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/connexion" replace />;
  if (user.is_staff) return children;

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-sm text-center">
        <ShieldCheck className="mx-auto size-10 text-brand" aria-hidden />
        <h1 className="mt-4 text-xl font-bold">Accès réservé à l'administrateur</h1>
        <p className="mt-2 text-sm text-muted">
          Le compte {user.email} n'a pas accès à l'espace d'administration.
        </p>
        <Button className="mt-6" loading={logout.isPending} onClick={() => logout.mutate()}>
          Changer de compte
        </Button>
      </div>
    </main>
  );
}
