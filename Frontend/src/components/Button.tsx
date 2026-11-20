import { LoaderCircle, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

export const BUTTON_BASE =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

export const VARIANTS = {
  // Texte bleu nuit sur orange : le blanc n'y serait pas assez lisible.
  primary: "bg-brand text-ink hover:bg-brand-hover active:bg-brand-hover",
  secondary: "border border-line bg-white text-ink hover:bg-canvas",
  /** Bouton discret posé sur un fond bleu nuit. */
  onDark: "border border-white/25 bg-white/10 text-white hover:bg-white/20",
  danger: "bg-danger text-white hover:bg-danger/90",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  /** Affiche un indicateur d'attente et désactive le bouton. */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={loading || props.disabled}
      className={`${BUTTON_BASE} ${VARIANTS[variant]} ${className}`}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Nom de l'action, lu par les lecteurs d'écran et affiché au survol. */
  label: string;
  danger?: boolean;
}

/** Petit bouton carré ne contenant qu'une icône, pour les actions d'une ligne de tableau. */
export function IconButton({ icon: Icon, label, danger = false, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      {...props}
      aria-label={label}
      title={label}
      className={`grid size-9 place-items-center rounded-lg text-muted transition-colors duration-150 disabled:opacity-40 ${
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-brand-soft hover:text-brand-strong"
      }`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
