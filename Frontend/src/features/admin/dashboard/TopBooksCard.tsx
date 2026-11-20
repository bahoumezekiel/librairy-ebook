import { BookOpen } from "lucide-react";
import { motion } from "motion/react";

import type { TopBook } from "@/api/types";
import { Card, CardHeader } from "@/components/Card";
import { formatMoney } from "@/lib/format";

/** Classement des livres payants les plus vendus pendant la période. */
export function TopBooksCard({ books, periodDays }: { books: TopBook[]; periodDays: number }) {
  const bestSales = books[0]?.sales ?? 0;

  return (
    <Card>
      <CardHeader
        title="Livres les plus vendus"
        legend={`Ventes des ${periodDays} derniers jours ; la barre compare chaque livre au premier`}
      />
      {books.length === 0 ? (
        <div className="grid place-items-center py-10 text-center">
          <BookOpen className="size-8 text-muted" aria-hidden />
          <p className="mt-3 text-sm text-muted">Aucune vente sur cette période.</p>
        </div>
      ) : (
        <ol className="space-y-5">
          {books.map((book, index) => (
            <li key={book.slug} className="flex items-center gap-4">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                  index === 0 ? "bg-brand-soft text-brand-strong" : "bg-canvas text-muted"
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="truncate text-sm font-bold">{book.title}</p>
                  <p className="shrink-0 text-sm font-bold tabular-nums">
                    {formatMoney(book.revenue)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
                    <motion.div
                      className="h-full origin-left rounded-full bg-brand"
                      style={{ width: `${(book.sales / bestSales) * 100}%` }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut", delay: index * 0.05 }}
                    />
                  </div>
                  <p className="w-20 shrink-0 text-right text-xs text-muted">
                    {book.sales} {book.sales > 1 ? "ventes" : "vente"}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
