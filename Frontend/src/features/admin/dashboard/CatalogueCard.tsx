import { Banknote, Gift } from "lucide-react";

import type { DashboardStats } from "@/api/types";
import { Card, CardHeader } from "@/components/Card";
import { formatNumber, formatPercent } from "@/lib/format";

import { ShareBar } from "./ShareBar";

/** Livres publiés, répartis entre gratuits et payants. */
export function CatalogueCard({ books }: { books: DashboardStats["books"] }) {
  const total = books.free + books.paid;
  const kinds = [
    { key: "free", label: "Gratuits", value: books.free, icon: Gift, bar: "bg-leaf", text: "text-leaf-strong" },
    { key: "paid", label: "Payants", value: books.paid, icon: Banknote, bar: "bg-brand", text: "text-brand-strong" },
  ];

  return (
    <Card>
      <CardHeader title="Catalogue publié" legend="Livres visibles par les visiteurs" />
      <p className="text-3xl font-bold tabular-nums">
        {formatNumber(total)}
        <span className="ml-2 text-sm font-normal text-muted">{total > 1 ? "livres" : "livre"}</span>
      </p>
      <div className="mt-4">
        <ShareBar shares={kinds.map(({ key, value, bar }) => ({ key, value, color: bar }))} />
      </div>
      <ul className="mt-6 space-y-4">
        {kinds.map(({ key, label, value, icon: Icon, text }) => (
          <li key={key} className="flex items-center gap-3 text-sm">
            <Icon className={`size-4 shrink-0 ${text}`} aria-hidden />
            <span className="flex-1">{label}</span>
            <span className="font-bold tabular-nums">{formatNumber(value)}</span>
            <span className="w-12 text-right tabular-nums text-muted">
              {formatPercent(value, total)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
