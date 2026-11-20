import { BookOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";

import { api, errorMessage } from "@/api/client";
import type { Book, Category, Paginated } from "@/api/types";
import { Button, IconButton } from "@/components/Button";
import { Card } from "@/components/Card";
import { type Column, DataTable, Pagination } from "@/components/DataTable";
import { INPUT_CLASS } from "@/components/Field";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { Count, PageHeader } from "@/components/PageHeader";
import { RatingSummary } from "@/components/Stars";
import { Switch } from "@/components/Switch";
import { Tabs } from "@/components/Tabs";
import { useToast } from "@/components/Toast";
import { BookForm } from "@/features/admin/books/BookForm";
import { useAdminList, useAdminMutation, useDebounced } from "@/features/admin/data";
import { formatMoney } from "@/lib/format";

type Kind = "" | "true" | "false";

/** Filtre gratuit / payant : la valeur est celle du paramètre `is_free` de l'API. */
const KIND_TABS: { value: Kind; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "true", label: "Gratuits" },
  { value: "false", label: "Payants" },
];

/** Fenêtre ouverte : création, modification d'un livre, ou aucune. */
type Editing = { book?: Book } | null;

export function BooksPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState<Kind>("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Book | null>(null);

  const categories = useAdminList<Category[]>("categories");
  const books = useAdminList<Paginated<Book>>("books", {
    search: useDebounced(search.trim()),
    category,
    is_free: kind,
    page,
  });
  const categoryNames = new Map(categories.data?.map(({ slug, name }) => [slug, name]));

  /** Change un filtre et revient à la première page. */
  const filter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const publish = useAdminMutation((book: Book) =>
    api(`/admin/books/${book.slug}/`, {
      method: "PATCH",
      body: { is_published: !book.is_published },
    }),
  );
  const remove = useAdminMutation((book: Book) =>
    api(`/admin/books/${book.slug}/`, { method: "DELETE" }),
  );

  const columns: Column<Book>[] = [
    {
      header: "Livre",
      cell: (book) => (
        <div className="flex items-center gap-4">
          <img
            src={book.cover}
            alt=""
            loading="lazy"
            className="h-14 w-10 shrink-0 rounded-md bg-canvas object-cover shadow-card"
          />
          <div className="min-w-0">
            <p className="truncate font-bold">{book.title}</p>
            <p className="truncate text-xs text-muted">{book.author}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Catégorie",
      cell: (book) => (
        <span className="text-muted">{categoryNames.get(book.category) ?? book.category}</span>
      ),
    },
    {
      header: "Prix",
      cell: (book) =>
        book.price === null ? (
          <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-xs font-bold text-leaf-strong">
            Gratuit
          </span>
        ) : (
          <span className="whitespace-nowrap font-bold tabular-nums">{formatMoney(book.price)}</span>
        ),
    },
    {
      header: "Format",
      cell: (book) => (
        <span className="rounded-md bg-canvas px-2 py-1 text-xs font-bold uppercase text-muted">
          {book.format}
        </span>
      ),
    },
    {
      header: "Note",
      cell: (book) => <RatingSummary average={book.rating_average} count={book.rating_count} />,
    },
    {
      header: "Publié",
      cell: (book) => (
        <Switch
          checked={book.is_published}
          label={book.is_published ? "Retirer du catalogue" : "Publier dans le catalogue"}
          disabled={publish.isPending}
          onChange={() =>
            publish.mutate(book, {
              onSuccess: () =>
                toast("success", book.is_published ? "Livre retiré du catalogue." : "Livre publié."),
              onError: (error) => toast("error", errorMessage(error)),
            })
          }
        />
      ),
    },
    {
      header: "Actions",
      className: "w-28 text-right",
      cell: (book) => (
        <span className="inline-flex gap-1">
          <IconButton icon={Pencil} label="Modifier" onClick={() => setEditing({ book })} />
          <IconButton icon={Trash2} label="Supprimer" danger onClick={() => setDeleting(book)} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Livres"
        subtitle={<Count value={books.data?.count} one="livre" many="livres" />}
        action={
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" aria-hidden />
            Nouveau livre
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-4 top-3.5 size-4 text-muted" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => filter(setSearch)(event.target.value)}
            placeholder="Rechercher par titre, auteur ou description"
            aria-label="Rechercher un livre"
            className={`${INPUT_CLASS} pl-11`}
          />
        </div>
        <select
          value={category}
          onChange={(event) => filter(setCategory)(event.target.value)}
          aria-label="Filtrer par catégorie"
          className={`${INPUT_CLASS} sm:w-56`}
        >
          <option value="">Toutes les catégories</option>
          {categories.data?.map(({ slug, name }) => (
            <option key={slug} value={slug}>
              {name}
            </option>
          ))}
        </select>
        <Tabs label="Filtrer par type" tabs={KIND_TABS} value={kind} onChange={filter(setKind)} />
      </div>

      <Card flush>
        <DataTable
          columns={columns}
          rows={books.data?.results}
          rowKey={(book) => book.slug}
          isError={books.isError}
          isFetching={books.isFetching}
          onRetry={() => books.refetch()}
          empty={{ icon: BookOpen, message: "Aucun livre ne correspond à ces critères." }}
        />
        <Pagination page={page} count={books.data?.count ?? 0} onChange={setPage} />
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.book ? "Modifier le livre" : "Nouveau livre"}
        size="lg"
      >
        <BookForm book={editing?.book} onDone={() => setEditing(null)} />
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Supprimer le livre"
        message={
          <>
            Le livre <span className="font-bold text-ink">{deleting?.title}</span> et ses fichiers
            seront supprimés définitivement.
          </>
        }
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => toast("success", "Livre supprimé."),
            onError: (error) => toast("error", errorMessage(error)),
            onSettled: () => setDeleting(null),
          })
        }
      />
    </>
  );
}
