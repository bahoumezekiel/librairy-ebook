import { useQuery } from "@tanstack/react-query";
import { BookOpen, CloudOff, HardDrive, LibraryBig, LoaderCircle, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";

import { isNetworkError } from "@/api/client";
import { BUTTON_BASE, VARIANTS } from "@/components/Button";
import { cascade, fadeUp } from "@/components/motion";
import { useSession } from "@/features/auth/session";
import { useLibrary } from "@/features/public/data";
import { formatDate } from "@/lib/format";
import { isLicenseValid, listOfflineBooks, usedStorage } from "@/offline/store";

interface ShelfItem {
  slug: string;
  title: string;
  author: string;
  cover: string;
  /** Date d'achat (en ligne) ; absente pour un livre listé hors ligne. */
  purchasedAt?: string;
  /** Vrai quand la copie personnelle peut être ouverte. */
  ready: boolean;
  /** Fin de la licence hors ligne si le livre est enregistré sur l'appareil. */
  offlineUntil?: string;
}

const formatSize = (bytes: number) => `${(bytes / 1024 ** 2).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

/** Livres enregistrés sur l'appareil et espace qu'ils occupent. */
function useDeviceShelf() {
  return useQuery({
    queryKey: ["offline-books"],
    queryFn: async () => ({ books: await listOfflineBooks(), used: await usedStorage() }),
    // Lecture locale (IndexedDB) : aucun besoin du réseau.
    networkMode: "always",
  });
}

/**
 * État hors ligne du livre sur cet appareil. Aucune date n'est affichée : un livre acheté
 * l'est à vie, et l'autorisation de lecture hors ligne se renouvelle à chaque ouverture en ligne.
 */
function OfflineBadge({ until }: { until?: string }) {
  if (!until) return null;
  const valid = isLicenseValid({ expiresAt: until });
  return valid ? (
    <span className="inline-flex w-fit items-center gap-1.5 bg-leaf-soft px-2.5 py-1 text-xs font-bold text-leaf-strong">
      <HardDrive className="size-3.5" aria-hidden />
      Enregistré sur cet appareil
    </span>
  ) : (
    <span className="inline-flex w-fit items-center gap-1.5 bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong">
      <CloudOff className="size-3.5" aria-hidden />
      Ouvrez-le une fois connecté pour le relire hors ligne
    </span>
  );
}

/**
 * Bibliothèque personnelle. En ligne : les achats du compte, avec leur état hors ligne.
 * Sans réseau : les livres enregistrés sur cet appareil, lisibles tant que leur licence court.
 */
export function LibraryPage() {
  const session = useSession();
  const offline = Boolean(session.error && isNetworkError(session.error));
  const library = useLibrary();
  const device = useDeviceShelf();
  const stored = new Map(device.data?.books.map((book) => [book.slug, book]));

  const items: ShelfItem[] | undefined = offline
    ? device.data?.books.map((book) => ({ ...book, ready: true, offlineUntil: book.expiresAt }))
    : library.data?.map(({ book, purchased_at, is_ready }) => ({
        slug: book.slug,
        title: book.title,
        author: book.author,
        cover: book.cover,
        purchasedAt: purchased_at,
        ready: is_ready,
        offlineUntil: stored.get(book.slug)?.expiresAt,
      }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold">Ma bibliothèque</h1>
          <p className="mt-2 text-muted">
            {items ? (
              <>
                <span className="font-bold text-brand-strong">{items.length}</span>{" "}
                {offline ? "livre(s) sur cet appareil" : items.length > 1 ? "livres achetés" : "livre acheté"}
              </>
            ) : (
              "Chargement…"
            )}
          </p>
        </div>
        {device.data && device.data.books.length > 0 && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <HardDrive className="size-4" aria-hidden />
            {device.data.books.length} livre(s) hors ligne · {formatSize(device.data.used)} utilisés sur cet appareil
          </p>
        )}
      </header>

      {offline && (
        <p className="mb-8 flex items-center gap-3 border border-brand/30 bg-brand-soft px-5 py-4 text-sm font-bold text-brand-strong">
          <WifiOff className="size-5 shrink-0" aria-hidden />
          Vous êtes hors ligne : seuls les livres enregistrés sur cet appareil sont affichés.
        </p>
      )}

      {!offline && library.isError ? (
        <p className="py-20 text-center font-bold">Impossible de charger votre bibliothèque.</p>
      ) : !items ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Chargement">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-44 animate-pulse bg-line/70" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center bg-canvas px-6 py-20 text-center">
          <LibraryBig className="size-10 text-muted" aria-hidden />
          <p className="mt-4 font-bold">
            {offline ? "Aucun livre n'est enregistré sur cet appareil." : "Votre bibliothèque est vide."}
          </p>
          <p className="mt-1 text-sm text-muted">
            {offline
              ? "Ouvrez un livre une première fois avec internet pour pouvoir le lire ensuite hors ligne."
              : "Les livres que vous achetez apparaissent ici."}
          </p>
          {!offline && (
            <Link to="/catalogue?type=payant" className={`${BUTTON_BASE} ${VARIANTS.primary} mt-6`}>
              Découvrir les livres
            </Link>
          )}
        </div>
      ) : (
        <motion.ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" variants={cascade} initial="hidden" animate="visible">
          {items.map((item) => (
            <motion.li key={item.slug} variants={fadeUp} className="flex h-full gap-5 border border-line bg-white p-5">
              <img src={item.cover} alt={`Couverture de ${item.title}`} className="h-36 w-24 shrink-0 bg-line object-cover shadow-card" />
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="line-clamp-2 font-bold leading-snug">{item.title}</h2>
                <p className="mt-1 truncate text-sm text-muted">{item.author}</p>
                {item.purchasedAt && <p className="mt-1 text-xs text-muted">Acheté le {formatDate(item.purchasedAt)}</p>}
                <div className="mt-3">
                  <OfflineBadge until={item.offlineUntil} />
                </div>
                <div className="mt-auto pt-4">
                  {item.ready ? (
                    <Link
                      to={`/lire/${item.slug}`}
                      className="inline-flex h-11 items-center gap-2 bg-ink px-5 text-sm font-bold text-white transition-colors duration-150 hover:bg-brand hover:text-ink"
                    >
                      <BookOpen className="size-4" aria-hidden />
                      Lire
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-strong">
                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                      Préparation de votre exemplaire
                    </span>
                  )}
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
