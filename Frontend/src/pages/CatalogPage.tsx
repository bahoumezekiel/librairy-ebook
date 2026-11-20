import { BookOpen, Search, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { Button } from "@/components/Button";
import { Pagination } from "@/components/DataTable";
import { INPUT_CLASS } from "@/components/Field";
import { cascade } from "@/components/motion";
import { Tabs } from "@/components/Tabs";
import { useDebounced } from "@/features/admin/data";
import { BOOK_GRID, BookCard, BookCardSkeleton } from "@/features/public/BookCard";
import { useBooks, useCategories } from "@/features/public/data";

type Kind = "" | "gratuit" | "payant";

const KIND_TABS: { value: Kind; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "gratuit", label: "Gratuits" },
  { value: "payant", label: "Payants" },
];
/** Valeur du paramètre `is_free` de l'API pour chaque onglet. */
const IS_FREE: Record<Kind, string> = { "": "", gratuit: "true", payant: "false" };

const SORTS = [
  { value: "", label: "Plus récents" },
  { value: "rating", label: "Mieux notés" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
];

const CHIP = "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors duration-150";

/**
 * Catalogue. Les filtres vivent dans l'adresse (?q=…&categorie=…&type=…&tri=…&page=…) :
 * une recherche se partage par un lien et survit au bouton « retour ».
 */
export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("categorie") ?? "";
  const kind = (params.get("type") ?? "") as Kind;
  const sort = params.get("tri") ?? "";
  const page = Number(params.get("page")) || 1;

  const [typed, setTyped] = useState(query);
  const debounced = useDebounced(typed.trim());

  /** Modifie un filtre dans l'adresse ; tout changement de filtre revient à la première page. */
  const setFilter = (key: string, value: string | number) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (key !== "page") next.delete("page");
        if (value && value !== 1) next.set(key, String(value));
        else next.delete(key);
        return next;
      },
      { replace: key === "q" },
    );

  // La saisie rejoint l'adresse une fois que l'on a fini de taper.
  useEffect(() => {
    if (debounced !== query) setFilter("q", debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const categories = useCategories();
  const books = useBooks({ search: query, category, is_free: IS_FREE[kind] ?? "", sort, page });
  const filtered = Boolean(query || category || kind || sort);

  const reset = () => {
    setTyped("");
    setParams({});
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">Catalogue</h1>
        <p className="mt-2 text-muted">
          {books.data ? (
            <>
              <span className="font-bold text-brand-strong">{books.data.count}</span>{" "}
              {books.data.count > 1 ? "livres trouvés" : "livre trouvé"}
            </>
          ) : (
            "Chargement…"
          )}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-4 top-3.5 size-4 text-muted" aria-hidden />
          <input
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Rechercher un titre, un auteur, un sujet"
            aria-label="Rechercher un livre"
            className={`${INPUT_CLASS} pl-11`}
          />
        </div>
        <Tabs label="Type de livre" tabs={KIND_TABS} value={kind} onChange={(value) => setFilter("type", value)} />
        <div className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted" aria-hidden />
          <select
            value={sort}
            onChange={(event) => setFilter("tri", event.target.value)}
            aria-label="Trier les livres"
            className={`${INPUT_CLASS} pl-11`}
          >
            {SORTS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Catégories">
        {[{ slug: "", name: "Toutes les catégories" }, ...(categories.data ?? [])].map(({ slug, name }) => (
          <button
            key={slug}
            type="button"
            aria-pressed={slug === category}
            onClick={() => setFilter("categorie", slug)}
            className={`${CHIP} ${
              slug === category
                ? "border-ink bg-ink font-bold text-white"
                : "border-line bg-white text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-10">
        {books.isError ? (
          <div className="grid place-items-center py-20 text-center">
            <p className="font-bold">Impossible de charger le catalogue.</p>
            <Button variant="secondary" className="mt-5" onClick={() => books.refetch()}>
              Réessayer
            </Button>
          </div>
        ) : !books.data ? (
          <div className={BOOK_GRID}>
            {Array.from({ length: 10 }, (_, index) => (
              <BookCardSkeleton key={index} />
            ))}
          </div>
        ) : books.data.results.length === 0 ? (
          <motion.div
            className="grid place-items-center bg-canvas py-20 text-center"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <BookOpen className="size-10 text-muted" aria-hidden />
            <p className="mt-4 font-bold">Aucun livre ne correspond à votre recherche.</p>
            <p className="mt-1 text-sm text-muted">Essayez un autre mot ou retirez un filtre.</p>
            {filtered && (
              <Button variant="secondary" className="mt-6" onClick={reset}>
                <X className="size-4" aria-hidden />
                Effacer les filtres
              </Button>
            )}
          </motion.div>
        ) : (
          <>
            {/* Les cartes glissent vers leur nouvelle place quand un filtre change. */}
            <motion.div
              className={`${BOOK_GRID} transition-opacity duration-150 ${books.isPlaceholderData ? "opacity-50" : ""}`}
              variants={cascade}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence mode="popLayout">
                {books.data.results.map((book) => (
                  <BookCard key={book.slug} book={book} />
                ))}
              </AnimatePresence>
            </motion.div>
            <div className="mt-12 overflow-hidden border border-line empty:hidden">
              <Pagination page={page} count={books.data.count} onChange={(next) => setFilter("page", next)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
