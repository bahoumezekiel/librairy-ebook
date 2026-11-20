import type { ReactNode } from "react";

interface CardProps {
  className?: string;
  /** Sans marge intérieure : pour un contenu qui va d'un bord à l'autre, comme un tableau. */
  flush?: boolean;
  children: ReactNode;
}

/** Carte blanche : le conteneur de base de l'interface. */
export function Card({ className = "", flush = false, children }: CardProps) {
  return (
    <section
      className={`h-full rounded-2xl border border-line bg-white shadow-card ${flush ? "overflow-hidden" : "p-6"} ${className}`}
    >
      {children}
    </section>
  );
}

/** En-tête de carte : titre, légende qui explique ce que montre la carte, action à droite. */
export function CardHeader({
  title,
  legend,
  aside,
}: {
  title: string;
  legend: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{legend}</p>
      </div>
      {aside}
    </header>
  );
}
