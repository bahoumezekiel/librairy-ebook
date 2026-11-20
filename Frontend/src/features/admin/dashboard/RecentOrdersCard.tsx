import { ArrowRight, ShoppingBag } from "lucide-react";
import { Link } from "react-router";

import type { Order } from "@/api/types";
import { Card, CardHeader } from "@/components/Card";
import { OrderStatusBadge } from "@/features/admin/orders/status";
import { formatDateTime, formatMoney } from "@/lib/format";

/** Dernières commandes reçues, avec un accès à la liste complète. */
export function RecentOrdersCard({ orders }: { orders: Order[] }) {
  return (
    <Card>
      <CardHeader
        title="Dernières commandes"
        legend="Les plus récentes, tous statuts confondus"
        aside={
          <Link
            to="/admin/commandes"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg text-sm font-bold text-brand-strong hover:underline"
          >
            Tout voir
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />
      {orders.length === 0 ? (
        <div className="grid place-items-center py-10 text-center">
          <ShoppingBag className="size-8 text-muted" aria-hidden />
          <p className="mt-3 text-sm text-muted">Aucune commande pour le moment.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate text-sm font-bold">{order.book}</p>
                <p className="truncate text-xs text-muted">
                  {order.client} · {formatDateTime(order.created_at)}
                </p>
              </div>
              <span className="w-28">
                <OrderStatusBadge status={order.status} />
              </span>
              <p className="w-28 text-right text-sm font-bold tabular-nums">
                {formatMoney(order.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
