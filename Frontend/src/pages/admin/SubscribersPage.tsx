import { Copy, Newspaper, Trash2 } from "lucide-react";
import { useState } from "react";

import { api, errorMessage } from "@/api/client";
import type { Paginated, Subscriber } from "@/api/types";
import { Button, IconButton } from "@/components/Button";
import { Card } from "@/components/Card";
import { type Column, DataTable, Pagination } from "@/components/DataTable";
import { ConfirmDialog } from "@/components/Modal";
import { Count, PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useAdminList, useAdminMutation } from "@/features/admin/data";
import { formatDateTime } from "@/lib/format";

/** Abonnés à la newsletter : liste, copie des adresses, désinscription. */
export function SubscribersPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Subscriber | null>(null);
  const [copying, setCopying] = useState(false);
  const subscribers = useAdminList<Paginated<Subscriber>>("subscribers", { page });
  const remove = useAdminMutation((subscriber: Subscriber) =>
    api(`/admin/subscribers/${subscriber.id}/`, { method: "DELETE" }),
  );

  /** Copie toutes les adresses, séparées par des virgules, pour les coller dans un outil d'envoi. */
  const copyAll = async () => {
    setCopying(true);
    try {
      const emails: string[] = [];
      for (let next = 1; ; next += 1) {
        const batch = await api<Paginated<Subscriber>>(`/admin/subscribers/?page=${next}`);
        emails.push(...batch.results.map((subscriber) => subscriber.email));
        if (emails.length >= batch.count) break;
      }
      await navigator.clipboard.writeText(emails.join(", "));
      toast("success", `${emails.length} adresse${emails.length > 1 ? "s copiées" : " copiée"}.`);
    } catch (error) {
      toast("error", error instanceof Error ? errorMessage(error) : "La copie a échoué.");
    } finally {
      setCopying(false);
    }
  };

  const columns: Column<Subscriber>[] = [
    { header: "Adresse e-mail", cell: (subscriber) => <span className="font-bold">{subscriber.email}</span> },
    {
      header: "Inscrit le",
      cell: (subscriber) => <span className="whitespace-nowrap text-muted">{formatDateTime(subscriber.subscribed_at)}</span>,
    },
    {
      header: "Actions",
      className: "w-28 text-right",
      cell: (subscriber) => (
        <IconButton icon={Trash2} label="Désinscrire" danger onClick={() => setDeleting(subscriber)} />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Newsletter"
        subtitle={<Count value={subscribers.data?.count} one="abonné" many="abonnés" />}
        action={
          <Button variant="secondary" loading={copying} disabled={!subscribers.data?.count} onClick={copyAll}>
            <Copy className="size-4" aria-hidden />
            Copier les adresses
          </Button>
        }
      />
      <Card flush>
        <DataTable
          columns={columns}
          rows={subscribers.data?.results}
          rowKey={(subscriber) => String(subscriber.id)}
          isError={subscribers.isError}
          isFetching={subscribers.isFetching}
          onRetry={() => subscribers.refetch()}
          empty={{ icon: Newspaper, message: "Aucun abonné pour le moment." }}
        />
        <Pagination page={page} count={subscribers.data?.count ?? 0} onChange={setPage} />
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Désinscrire l'abonné"
        message={
          <>
            L'adresse <span className="font-bold text-ink">{deleting?.email}</span> sera retirée de
            la newsletter.
          </>
        }
        confirmLabel="Désinscrire"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => toast("success", "Abonné désinscrit."),
            onError: (error) => toast("error", errorMessage(error)),
            onSettled: () => setDeleting(null),
          })
        }
      />
    </>
  );
}
