import { AuthShell } from "@/features/auth/AuthShell";
import { RedirectSignedIn } from "@/features/auth/fields";
import { LoginForm } from "@/features/auth/LoginForm";
import { useSession } from "@/features/auth/session";

/** Connexion à l'interface d'administration, distincte de celle de l'espace public. */
export function AdminLoginPage() {
  const session = useSession();
  if (session.data) return <RedirectSignedIn user={session.data} />;

  return (
    <AuthShell title="Administration" subtitle="Espace réservé à l'administrateur de FasoLib.">
      <LoginForm />
    </AuthShell>
  );
}
