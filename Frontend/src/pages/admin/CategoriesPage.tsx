import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { api, errorMessage } from "@/api/client";
import type { Category } from "@/api/types";
import { Button, IconButton } from "@/components/Button";
import { Card } from "@/components/Card";
import { type Column, DataTable } from "@/components/DataTable";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { Count, PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { CategoryForm } from "@/features/admin/categories/CategoryForm";
import { useAdminList, useAdminMutation } from "@/features/admin/data";

/** Fenêtre ouverte : création, modification d'une catégorie, ou aucune. */
type Editing = { category?: Category } | null;

export function CategoriesPage() {
  const toast = useToast();
  const categories = useAdminList<Category[]>("categories");
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const remove = useAdminMutation((category: Category) =>
    api(`/admin/categories/${category.slug}/`, { method: "DELETE" }),
  );

  const columns: Column<Category>[] = [
    {
      header: "Position",
      className: "w-24",
      cell: (category) => (
        <span className="grid size-8 place-items-center rounded-lg bg-canvas text-sm font-bold">
          {category.position}
        </span>
      ),
    },
    {
      header: "Nom",
      cell: (category) => (
        <>
          <span className="block font-bold">{category.name}</span>
          <span className="block font-mono text-xs text-muted">{category.slug}</span>
        </>
      ),
    },
    {
      header: "Description",
      cell: (category) => <span className="text-muted">{category.description || "—"}</span>,
    },
    {
      header: "Actions",
      className: "w-28 text-right",
      cell: (category) => (
        <span className="inline-flex gap-1">
          <IconButton icon={Pencil} label="Modifier" onClick={() => setEditing({ category })} />
          <IconButton icon={Trash2} label="Supprimer" danger onClick={() => setDeleting(category)} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Catégories"
        subtitle={<Count value={categories.data?.length} one="catégorie" many="catégories" />}
        action={
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" aria-hidden />
            Nouvelle catégorie
          </Button>
        }
      />
      <Card flush>
        <DataTable
          columns={columns}
          rows={categories.data}
          rowKey={(category) => category.slug}
          isError={categories.isError}
          isFetching={categories.isFetching}
          onRetry={() => categories.refetch()}
          empty={{ icon: FolderTree, message: "Aucune catégorie. Ajoutez la première." }}
        />
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.category ? "Modifier la catégorie" : "Nouvelle catégorie"}
      >
        <CategoryForm category={editing?.category} onDone={() => setEditing(null)} />
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Supprimer la catégorie"
        message={
          <>
            La catégorie <span className="font-bold text-ink">{deleting?.name}</span> sera supprimée
            définitivement.
          </>
        }
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => toast("success", "Catégorie supprimée."),
            onError: (error) => toast("error", errorMessage(error)),
            onSettled: () => setDeleting(null),
          })
        }
      />
    </>
  );
}
