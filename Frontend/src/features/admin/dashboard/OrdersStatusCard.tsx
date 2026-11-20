import type { DashboardStats } from "@/api/types";
import { Card, CardHeader } from "@/components/Card";
import { ORDER_STATUSES } from "@/features/admin/orders/status";
import { formatNumber, formatPercent } from "@/lib/format";

import { ShareBar } from "./ShareBar";

interface OrdersStatusCardProps {
  orders: DashboardStats["orders_by_status"];
  periodDays: number;
}

/** Répartition par statut des commandes lancées pendant la période. */
export function OrdersStatusCard({ orders, periodDays }: OrdersStatusCardProps) {
  const total = ORDER_STATUSES.reduce((sum, status) => sum + orders[status.key], 0);

  return (
    <Card>
      <CardHeader
        title="Commandes par statut"
        legend={`Commandes lancées sur les ${periodDays} derniers jours`}
      />
      <p className="text-3xl font-bold tabular-nums">
        {formatNumber(total)}
        <span className="ml-2 text-sm font-normal text-muted">
          {total > 1 ? "commandes" : "commande"}
        </span>
      </p>
      <div className="mt-4">
        <ShareBar
          shares={ORDER_STATUSES.map((status) => ({
            key: status.key,
            value: orders[status.key],
            color: status.bar,
          }))}
        />
      </div>
      <ul className="mt-6 space-y-4">
        {ORDER_STATUSES.map(({ key, plural, icon: Icon, text }) => (
          <li key={key} className="flex items-center gap-3 text-sm">
            <Icon className={`size-4 shrink-0 ${text}`} aria-hidden />
            <span className="flex-1">{plural}</span>
            <span className="font-bold tabular-nums">{formatNumber(orders[key])}</span>
            <span className="w-12 text-right tabular-nums text-muted">
              {formatPercent(orders[key], total)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
