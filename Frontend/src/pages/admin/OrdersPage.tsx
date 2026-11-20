import { ShoppingBag } from "lucide-react";
import { useState } from "react";

import type { Order, OrderStatus, Paginated } from "@/api/types";
import { Card } from "@/components/Card";
import { type Column, DataTable, Pagination } from "@/components/DataTable";
import { Count, PageHeader } from "@/components/PageHeader";
import { Tabs } from "@/components/Tabs";
import { useAdminList } from "@/features/admin/data";
import { ORDER_STATUSES, OrderStatusBadge } from "@/features/admin/orders/status";
import { formatDateTime, formatMoney } from "@/lib/format";

type StatusFilter = OrderStatus | "";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "Toutes" },
  ...ORDER_STATUSES.map(({ key, plural }) => ({ value: key, label: plural })),
];

const COLUMNS: Column<Order>[] = [
  {
    header: "Date",
    cell: (order) => <span className="whitespace-nowrap">{formatDateTime(order.created_at)}</span>,
  },
  { header: "Client", cell: (order) => <span className="text-muted">{order.client}</span> },
  { header: "Livre", cell: (order) => <span className="font-bold">{order.book}</span> },
  {
    header: "Montant",
    className: "text-right",
    cell: (order) => (
      <span className="whitespace-nowrap font-bold tabular-nums">{formatMoney(order.amount)}</span>
    ),
  },
  { header: "Statut", cell: (order) => <OrderStatusBadge status={order.status} /> },
  {
    header: "Référence",
    cell: (order) => (
      <span className="whitespace-nowrap font-mono text-xs text-muted">{order.payment_reference ?? "—"}</span>
    ),
  },
];

export function OrdersPage() {
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const orders = useAdminList<Paginated<Order>>("orders", { status, page });

  return (
    <>
      <PageHeader
        title="Commandes"
        subtitle={<Count value={orders.data?.count} one="commande" many="commandes" />}
      />
      <div className="mb-6">
        <Tabs
          label="Filtrer par statut"
          tabs={STATUS_TABS}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </div>
      <Card flush>
        <DataTable
          columns={COLUMNS}
          rows={orders.data?.results}
          rowKey={(order) => order.id}
          isError={orders.isError}
          isFetching={orders.isFetching}
          onRetry={() => orders.refetch()}
          empty={{ icon: ShoppingBag, message: "Aucune commande ne correspond à ce filtre." }}
        />
        <Pagination page={page} count={orders.data?.count ?? 0} onChange={setPage} />
      </Card>
    </>
  );
}
