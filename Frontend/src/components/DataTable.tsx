import { ChevronLeft, ChevronRight, CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PAGE_SIZE } from "@/api/types";
import { formatNumber } from "@/lib/format";

import { Button } from "./Button";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Classes appliquées à l'en-tête et aux cellules de la colonne (alignement, largeur). */
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isError: boolean;
  /** Vrai pendant un rechargement : le tableau reste affiché, légèrement estompé. */
  isFetching: boolean;
  onRetry: () => void;
  empty: { icon: LucideIcon; message: string };
}

function State({ children }: { children: ReactNode }) {
  return <div className="grid place-items-center px-6 py-16 text-center">{children}</div>;
}

/** Tableau de données avec ses états : chargement, erreur, liste vide. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isError,
  isFetching,
  onRetry,
  empty,
}: DataTableProps<T>) {
  if (isError) {
    return (
      <State>
        <CircleAlert className="size-8 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-bold">Impossible de charger les données.</p>
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Réessayer
        </Button>
      </State>
    );
  }
  if (!rows) {
    return (
      <div className="space-y-3 p-6" role="status" aria-label="Chargement">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-line/60" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <State>
        <empty.icon className="size-8 text-muted" aria-hidden />
        <p className="mt-3 text-sm text-muted">{empty.message}</p>
      </State>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full min-w-160 text-left text-sm transition-opacity duration-150 ${isFetching ? "opacity-60" : ""}`}
      >
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
            {columns.map((column) => (
              <th key={column.header} className={`whitespace-nowrap px-6 py-4 font-bold ${column.className ?? ""}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-line transition-colors duration-150 last:border-0 hover:bg-canvas"
            >
              {columns.map((column) => (
                <td key={column.header} className={`px-6 py-4 ${column.className ?? ""}`}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  /** Nombre total d'éléments, toutes pages confondues. */
  count: number;
  onChange: (page: number) => void;
}

/** Pied de tableau : éléments affichés et boutons page précédente / suivante. */
export function Pagination({ page, count, onChange }: PaginationProps) {
  if (count <= PAGE_SIZE) return null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, count);
  const buttonClass =
    "grid size-9 place-items-center rounded-lg border border-line text-ink transition-colors duration-150 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <footer className="flex items-center justify-between gap-4 border-t border-line px-6 py-4 text-sm text-muted">
      <p>
        <span className="font-bold text-ink">
          {first}–{last}
        </span>{" "}
        sur {formatNumber(count)}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={last === count}
          onClick={() => onChange(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </footer>
  );
}
