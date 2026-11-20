import { LoginForm } from "@/features/auth/LoginForm";

/** Onglet « Connexion » de l'espace public (cadre : `AuthLayout`). */
export function LoginPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Bon retour parmi nous</h1>
      <p className="mb-8 mt-2 text-sm text-muted">
        Connectez-vous pour retrouver votre bibliothèque et vos achats.
      </p>
      <LoginForm />
    </>
  );
}
