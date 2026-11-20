import { CircleAlert, Eye, EyeOff, Lock, type LucideIcon } from "lucide-react";
import { type InputHTMLAttributes, useState } from "react";
import { Navigate, useLocation } from "react-router";

import type { User } from "@/api/types";

const INPUT_CLASS =
  "h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm placeholder:text-muted/70 aria-invalid:border-danger";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
}

/** Champ des écrans de connexion et d'inscription : icône à gauche, erreur dessous. */
export function AuthField({ id, label, icon: Icon, error, className = "", ...props }: AuthFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-4 top-4 size-4 text-muted" aria-hidden />
        <input id={id} aria-invalid={Boolean(error)} className={`${INPUT_CLASS} ${className}`} {...props} />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Champ de mot de passe avec un bouton pour afficher ou masquer la saisie. */
export function PasswordField(props: Omit<AuthFieldProps, "icon" | "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <AuthField {...props} icon={Lock} type={visible ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute right-2 top-9 grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** Bandeau d'erreur affiché en tête d'un formulaire. */
export function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      <CircleAlert className="size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/**
 * Redirige un utilisateur déjà connecté : vers la page qu'il voulait ouvrir,
 * sinon vers l'interface admin (administrateur) ou l'accueil (client).
 */
export function RedirectSignedIn({ user }: { user: User }) {
  const { state } = useLocation();
  const target = (state as { from?: string } | null)?.from ?? (user.is_staff ? "/admin" : "/");
  return <Navigate to={target} replace />;
}
