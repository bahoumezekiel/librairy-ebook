import { Eye, Mail, Reply, Trash2 } from "lucide-react";
import { useState } from "react";

import { api, errorMessage } from "@/api/client";
import type { ContactMessage, Paginated } from "@/api/types";
import { BUTTON_BASE, IconButton, VARIANTS } from "@/components/Button";
import { Card } from "@/components/Card";
import { type Column, DataTable, Pagination } from "@/components/DataTable";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { Count, PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useAdminList, useAdminMutation } from "@/features/admin/data";
import { formatDateTime } from "@/lib/format";

/** Lien de réponse : ouvre la messagerie de l'administrateur, objet prérempli. */
const replyLink = ({ email, subject }: ContactMessage) =>
  `mailto:${email}?subject=${encodeURIComponent(`Re : ${subject}`)}`;

/** Messages envoyés par le formulaire de contact du site. */
export function MessagesPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [reading, setReading] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState<ContactMessage | null>(null);
  const messages = useAdminList<Paginated<ContactMessage>>("messages", { page });
  const remove = useAdminMutation((message: ContactMessage) =>
    api(`/admin/messages/${message.id}/`, { method: "DELETE" }),
  );

  const columns: Column<ContactMessage>[] = [
    {
      header: "Reçu le",
      cell: (message) => <span className="whitespace-nowrap">{formatDateTime(message.created_at)}</span>,
    },
    {
      header: "Expéditeur",
      cell: (message) => (
        <>
          <span className="block font-bold">{message.name}</span>
          <span className="block text-xs text-muted">{message.email}</span>
        </>
      ),
    },
    {
      header: "Message",
      cell: (message) => (
        <button type="button" onClick={() => setReading(message)} className="max-w-md text-left">
          <span className="block font-bold hover:text-brand-strong">{message.subject}</span>
          <span className="line-clamp-1 text-xs text-muted">{message.message}</span>
        </button>
      ),
    },
    {
      header: "Actions",
      className: "w-36 text-right",
      cell: (message) => (
        <span className="inline-flex gap-1">
          <IconButton icon={Eye} label="Lire" onClick={() => setReading(message)} />
          <a href={replyLink(message)} aria-label="Répondre par e-mail" title="Répondre par e-mail" className="grid size-9 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-brand-soft hover:text-brand-strong">
            <Reply className="size-4" aria-hidden />
          </a>
          <IconButton icon={Trash2} label="Supprimer" danger onClick={() => setDeleting(message)} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={<Count value={messages.data?.count} one="message reçu" many="messages reçus" />}
      />
      <Card flush>
        <DataTable
          columns={columns}
          rows={messages.data?.results}
          rowKey={(message) => String(message.id)}
          isError={messages.isError}
          isFetching={messages.isFetching}
          onRetry={() => messages.refetch()}
          empty={{ icon: Mail, message: "Aucun message pour le moment." }}
        />
        <Pagination page={page} count={messages.data?.count ?? 0} onChange={setPage} />
      </Card>

      <Modal open={reading !== null} onClose={() => setReading(null)} title={reading?.subject ?? ""} size="lg">
        {reading && (
          <>
            <p className="text-sm">
              <span className="font-bold">{reading.name}</span>{" "}
              <span className="text-muted">· {reading.email}</span>
            </p>
            <p className="mt-1 text-xs text-muted">Reçu le {formatDateTime(reading.created_at)}</p>
            <p className="mt-6 whitespace-pre-line leading-relaxed">{reading.message}</p>
            <div className="mt-8 flex justify-end">
              <a href={replyLink(reading)} className={`${BUTTON_BASE} ${VARIANTS.primary}`}>
                <Reply className="size-4" aria-hidden />
                Répondre par e-mail
              </a>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Supprimer le message"
        message={
          <>
            Le message de <span className="font-bold text-ink">{deleting?.name}</span> sera supprimé
            définitivement.
          </>
        }
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => toast("success", "Message supprimé."),
            onError: (error) => toast("error", errorMessage(error)),
            onSettled: () => setDeleting(null),
          })
        }
      />
    </>
  );
}
