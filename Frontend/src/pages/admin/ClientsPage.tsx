import { Users } from "lucide-react";
import { useState } from "react";

import type { Client, Paginated } from "@/api/types";
import { Card } from "@/components/Card";
import { type Column, DataTable, Pagination } from "@/components/DataTable";
import { Count, PageHeader } from "@/components/PageHeader";
import { useAdminList } from "@/features/admin/data";
import { formatDate } from "@/lib/format";

const COLUMNS: Column<Client>[] = [
  {
    header: "Client",
    cell: (client) => (
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">
          {(client.first_name[0] + client.last_name[0]).toUpperCase()}
        </span>
        <span className="font-bold">
          {client.first_name} {client.last_name}
        </span>
      </div>
    ),
  },
  { header: "Adresse e-mail", cell: (client) => <span className="text-muted">{client.email}</span> },
  { header: "Inscrit le", cell: (client) => formatDate(client.created_at) },
];

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const clients = useAdminList<Paginated<Client>>("users", { page });

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={<Count value={clients.data?.count} one="compte inscrit" many="comptes inscrits" />}
      />
      <Card flush>
        <DataTable
          columns={COLUMNS}
          rows={clients.data?.results}
          rowKey={(client) => client.id}
          isError={clients.isError}
          isFetching={clients.isFetching}
          onRetry={() => clients.refetch()}
          empty={{ icon: Users, message: "Aucun client inscrit pour le moment." }}
        />
        <Pagination page={page} count={clients.data?.count ?? 0} onChange={setPage} />
      </Card>
    </>
  );
}
