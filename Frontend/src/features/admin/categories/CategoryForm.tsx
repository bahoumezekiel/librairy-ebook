import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { api } from "@/api/client";
import type { Category } from "@/api/types";
import { Button } from "@/components/Button";
import { applyApiErrors, Field, INPUT_CLASS } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { useAdminMutation } from "@/features/admin/data";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Saisissez un nom.").max(100, "100 caractères au maximum."),
  description: z.string().trim(),
  position: z
    .number({ error: "Saisissez un nombre." })
    .int("Saisissez un nombre entier.")
    .min(0, "La position ne peut pas être négative."),
});
type CategoryValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  /** Catégorie à modifier ; absente pour une création. */
  category?: Category;
  onDone: () => void;
}

export function CategoryForm({ category, onDone }: CategoryFormProps) {
  const toast = useToast();
  const { register, handleSubmit, setError, formState } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      position: category?.position ?? 0,
    },
  });
  const { errors } = formState;

  const save = useAdminMutation((values: CategoryValues) =>
    category
      ? api(`/admin/categories/${category.slug}/`, { method: "PATCH", body: values })
      : api("/admin/categories/", { method: "POST", body: values }),
  );

  const submit = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => {
        toast("success", category ? "Catégorie modifiée." : "Catégorie ajoutée.");
        onDone();
      },
      onError: (error) => toast("error", applyApiErrors(error, setError)),
    }),
  );

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <Field label="Nom" htmlFor="category-name" error={errors.name?.message}>
        <input
          id="category-name"
          className={INPUT_CLASS}
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
      </Field>
      <Field
        label="Description"
        htmlFor="category-description"
        error={errors.description?.message}
        hint="Facultative."
      >
        <textarea
          id="category-description"
          rows={3}
          className={INPUT_CLASS}
          {...register("description")}
        />
      </Field>
      <Field
        label="Position"
        htmlFor="category-position"
        error={errors.position?.message}
        hint="Les catégories s'affichent de la plus petite position à la plus grande."
      >
        <input
          id="category-position"
          type="number"
          min={0}
          className={INPUT_CLASS}
          aria-invalid={Boolean(errors.position)}
          {...register("position", { valueAsNumber: true })}
        />
      </Field>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" loading={save.isPending}>
          {category ? "Enregistrer" : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}
