import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, ImagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { api } from "@/api/client";
import type { Book, Category } from "@/api/types";
import { Button } from "@/components/Button";
import { applyApiErrors, Field, INPUT_CLASS } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { useAdminList, useAdminMutation } from "@/features/admin/data";

// Mêmes limites que l'API, vérifiées ici pour prévenir avant l'envoi.
const MIN_PRICE = 200;
const MAX_COVER_MB = 10;
const MAX_BOOK_MB = 100;

const required = (message: string) => z.string().trim().min(1, message);
const tooBig = (files: FileList | undefined, megabytes: number) =>
  Boolean(files?.[0] && files[0].size > megabytes * 1024 ** 2);

/** Les fichiers sont obligatoires à la création, facultatifs à la modification. */
const bookSchema = (isEdit: boolean) =>
  z
    .object({
      title: required("Saisissez un titre.").max(255),
      author: required("Saisissez un auteur.").max(255),
      description: required("Saisissez une description."),
      category: required("Choisissez une catégorie."),
      kind: z.enum(["free", "paid"]),
      price: z.string(),
      is_published: z.boolean(),
      cover: z.custom<FileList>().optional(),
      file: z.custom<FileList>().optional(),
    })
    .superRefine((values, context) => {
      const issue = (path: string, message: string) =>
        context.addIssue({ code: "custom", path: [path], message });

      if (values.kind === "paid" && !(Number.isInteger(+values.price) && +values.price >= MIN_PRICE)) {
        issue("price", `Saisissez un prix d'au moins ${MIN_PRICE} FCFA, sans décimales.`);
      }
      if (!isEdit && !values.cover?.length) issue("cover", "Choisissez une couverture.");
      if (!isEdit && !values.file?.length) issue("file", "Choisissez le fichier du livre.");
      if (tooBig(values.cover, MAX_COVER_MB)) issue("cover", `${MAX_COVER_MB} Mo au maximum.`);
      if (tooBig(values.file, MAX_BOOK_MB)) issue("file", `${MAX_BOOK_MB} Mo au maximum.`);
    });
type BookValues = z.infer<ReturnType<typeof bookSchema>>;

/** Adresse temporaire pour prévisualiser une image choisie sur l'appareil. */
function useObjectUrl(file: File | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file) return setUrl(undefined);
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

function toFormData(values: BookValues) {
  const data = new FormData();
  for (const key of ["title", "author", "description", "category"] as const) {
    data.set(key, values[key]);
  }
  // Un prix vide rend le livre gratuit.
  data.set("price", values.kind === "paid" ? values.price : "");
  data.set("is_published", String(values.is_published));
  if (values.cover?.[0]) data.set("cover", values.cover[0]);
  if (values.file?.[0]) data.set("file", values.file[0]);
  return data;
}

const KINDS = [
  { value: "free", label: "Gratuit", checked: "peer-checked:border-leaf peer-checked:bg-leaf-soft peer-checked:text-leaf-strong" },
  { value: "paid", label: "Payant", checked: "peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-strong" },
];

interface BookFormProps {
  /** Livre à modifier ; absent pour une création. */
  book?: Book;
  onDone: () => void;
}

export function BookForm({ book, onDone }: BookFormProps) {
  const toast = useToast();
  const categories = useAdminList<Category[]>("categories");
  const { register, handleSubmit, setError, watch, formState } = useForm<BookValues>({
    resolver: zodResolver(bookSchema(Boolean(book))),
    defaultValues: {
      title: book?.title ?? "",
      author: book?.author ?? "",
      description: book?.description ?? "",
      category: book?.category ?? "",
      kind: book?.price ? "paid" : "free",
      price: book?.price ? String(book.price) : "",
      is_published: book?.is_published ?? false,
    },
  });
  const { errors } = formState;
  const coverPreview = useObjectUrl(watch("cover")?.[0]) ?? book?.cover;
  const chosenFile = watch("file")?.[0];

  const save = useAdminMutation((values: BookValues) =>
    book
      ? api(`/admin/books/${book.slug}/`, { method: "PATCH", body: toFormData(values) })
      : api("/admin/books/", { method: "POST", body: toFormData(values) }),
  );

  const submit = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => {
        toast("success", book ? "Livre modifié." : "Livre ajouté.");
        onDone();
      },
      onError: (error) => toast("error", applyApiErrors(error, setError)),
    }),
  );

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Titre" htmlFor="book-title" error={errors.title?.message}>
          <input
            id="book-title"
            className={INPUT_CLASS}
            aria-invalid={Boolean(errors.title)}
            {...register("title")}
          />
        </Field>
        <Field label="Auteur" htmlFor="book-author" error={errors.author?.message}>
          <input
            id="book-author"
            className={INPUT_CLASS}
            aria-invalid={Boolean(errors.author)}
            {...register("author")}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="book-description" error={errors.description?.message}>
        <textarea
          id="book-description"
          rows={4}
          className={INPUT_CLASS}
          aria-invalid={Boolean(errors.description)}
          {...register("description")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Catégorie" htmlFor="book-category" error={errors.category?.message}>
          <select
            id="book-category"
            className={INPUT_CLASS}
            aria-invalid={Boolean(errors.category)}
            {...register("category")}
          >
            <option value="">Choisir…</option>
            {categories.data?.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="mb-2 block text-sm font-bold">Type</legend>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map(({ value, label, checked }) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" value={value} className="peer sr-only" {...register("kind")} />
                <span
                  className={`flex h-11.5 items-center justify-center rounded-xl border border-line text-sm font-bold text-muted transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-brand ${checked}`}
                >
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {watch("kind") === "paid" && (
        <Field
          label="Prix (FCFA)"
          htmlFor="book-price"
          error={errors.price?.message}
          hint={`${MIN_PRICE} FCFA au minimum.`}
        >
          <input
            id="book-price"
            type="number"
            min={MIN_PRICE}
            step={1}
            className={INPUT_CLASS}
            aria-invalid={Boolean(errors.price)}
            {...register("price")}
          />
        </Field>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Couverture"
          htmlFor="book-cover"
          error={errors.cover?.message}
          hint={`JPEG, PNG ou WebP, ${MAX_COVER_MB} Mo au maximum.`}
        >
          <label
            htmlFor="book-cover"
            className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-line p-3 transition-colors duration-150 hover:border-brand hover:bg-brand-soft/40"
          >
            {coverPreview ? (
              <img src={coverPreview} alt="" className="h-20 w-14 rounded-lg object-cover" />
            ) : (
              <span className="grid h-20 w-14 place-items-center rounded-lg bg-canvas text-muted">
                <ImagePlus className="size-5" aria-hidden />
              </span>
            )}
            <span className="text-sm text-muted">
              {coverPreview ? "Changer l'image" : "Choisir une image"}
            </span>
          </label>
          <input
            id="book-cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            {...register("cover")}
          />
        </Field>

        <Field
          label="Fichier du livre"
          htmlFor="book-file"
          error={errors.file?.message}
          hint={`PDF ou EPUB, ${MAX_BOOK_MB} Mo au maximum.`}
        >
          <label
            htmlFor="book-file"
            className="flex h-26.5 cursor-pointer items-center gap-4 rounded-xl border border-dashed border-line p-3 transition-colors duration-150 hover:border-brand hover:bg-brand-soft/40"
          >
            <span className="grid h-20 w-14 shrink-0 place-items-center rounded-lg bg-canvas text-muted">
              <FileText className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 truncate text-sm text-muted">
              {chosenFile?.name ??
                (book ? `Fichier ${book.format.toUpperCase()} actuel conservé` : "Choisir un fichier")}
            </span>
          </label>
          <input
            id="book-file"
            type="file"
            accept=".pdf,.epub,application/pdf,application/epub+zip"
            className="sr-only"
            {...register("file")}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-canvas px-4 py-3">
        <input type="checkbox" className="size-4 accent-leaf" {...register("is_published")} />
        <span className="text-sm">
          <span className="font-bold">Publier dans le catalogue</span>
          <span className="block text-xs text-muted">Sinon le livre reste un brouillon invisible.</span>
        </span>
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" loading={save.isPending}>
          {book ? "Enregistrer" : "Ajouter le livre"}
        </Button>
      </div>
    </form>
  );
}
