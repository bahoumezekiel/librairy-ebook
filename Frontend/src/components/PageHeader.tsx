import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle: ReactNode;
  /** Bouton d'action principal de la page. */
  action?: ReactNode;
}

/** En-tête d'une section de l'interface admin. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

/** Nombre mis en valeur dans un sous-titre, par exemple « 12 clients ». */
export function Count({ value, one, many }: { value: number | undefined; one: string; many: string }) {
  if (value === undefined) return "Chargement…";
  return (
    <>
      <span className="font-bold text-brand-strong">{value}</span> {value > 1 ? many : one}
    </>
  );
}
