import { ArrowLeft, BookOpen, Download, FileText, ShieldCheck, ShoppingCart, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { Link, useNavigate, useParams } from "react-router";

import { errorMessage } from "@/api/client";
import type { CatalogBook } from "@/api/types";
import { Button, BUTTON_BASE, VARIANTS } from "@/components/Button";
import { cascade, fadeUp, Reveal } from "@/components/motion";
import { Stars } from "@/components/Stars";
import { useToast } from "@/components/Toast";
import { useSession } from "@/features/auth/session";
import { BOOK_GRID, BookCard, isNew, PriceTag } from "@/features/public/BookCard";
import { useBook, useBooks, useLibrary, usePlaceOrder } from "@/features/public/data";
import { RatingInput } from "@/features/public/RatingInput";
import { formatRating } from "@/lib/format";

const CTA = "h-13 w-full text-base";

/** Bouton principal de la fiche : télécharger, acheter, ou ouvrir sa bibliothèque. */
function MainAction({ book, owned }: { book: CatalogBook; owned: boolean }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { data: user } = useSession();
  const order = usePlaceOrder();

  if (book.is_free) {
    return (
      // Lien direct : le serveur redirige vers une adresse de téléchargement de courte durée.
      <a href={`/api/books/${book.slug}/download/`} className={`${BUTTON_BASE} ${VARIANTS.primary} ${CTA}`}>
        <Download className="size-5" aria-hidden />
        Télécharger gratuitement
      </a>
    );
  }
  if (owned) {
    return (
      <Link to={`/lire/${book.slug}`} className={`${BUTTON_BASE} ${VARIANTS.primary} ${CTA}`}>
        <BookOpen className="size-5" aria-hidden />
        Lire maintenant
      </Link>
    );
  }

  const buy = () => {
    if (!user) return navigate("/connexion", { state: { from: `/livres/${book.slug}` } });
    order.mutate(book.slug, {
      // Le client part sur la page de paiement ; il reviendra sur le suivi de sa commande.
      // Seule une adresse web (http ou https) est suivie : jamais un lien « javascript: » ou autre.
      onSuccess: ({ payment_url }) => {
        if (payment_url && /^https?:\/\//.test(payment_url)) window.location.assign(payment_url);
        else toast("error", "Le lien de paiement est invalide. Réessayez.");
      },
      onError: (error) => toast("error", errorMessage(error)),
    });
  };

  return (
    <Button className={CTA} loading={order.isPending || order.isSuccess} onClick={buy}>
      <ShoppingCart className="size-5" aria-hidden />
      Acheter ce livre
    </Button>
  );
}

function NotFound() {
  return (
    <div className="grid place-items-center px-4 py-32 text-center">
      <BookOpen className="size-10 text-muted" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold">Ce livre est introuvable</h1>
      <p className="mt-2 text-muted">Il a peut-être été retiré du catalogue.</p>
      <Link to="/catalogue" className={`${BUTTON_BASE} ${VARIANTS.primary} mt-8`}>
        Retour au catalogue
      </Link>
    </div>
  );
}

export function BookPage() {
  const { slug = "" } = useParams();
  const book = useBook(slug);
  const library = useLibrary();
  const category = book.data?.category.slug;
  // La catégorie n'est connue qu'une fois le livre chargé : rien n'est demandé avant.
  const related = useBooks({ category }, Boolean(category));

  if (book.isError) return <NotFound />;
  if (!book.data) {
    return (
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,22rem)_1fr]" role="status" aria-label="Chargement">
        <div className="aspect-2/3 animate-pulse bg-line/70" />
        <div className="space-y-4">
          <div className="h-10 w-3/4 animate-pulse rounded-xl bg-line/70" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-line/70" />
          <div className="h-40 animate-pulse bg-line/70" />
        </div>
      </div>
    );
  }

  const { data } = book;
  const owned = Boolean(library.data?.some((purchase) => purchase.book.slug === data.slug));
  const others = related.data?.results.filter((other) => other.slug !== data.slug).slice(0, 5) ?? [];
  const facts = [
    { icon: FileText, text: `Format ${data.format.toUpperCase()}` },
    data.is_free
      ? { icon: Download, text: "Téléchargement libre, sans compte" }
      : { icon: WifiOff, text: "Lisible hors ligne après l'achat" },
    { icon: ShieldCheck, text: data.is_free ? "Offert par l'auteur" : "Paiement sécurisé" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
      <Link to="/catalogue" className="group inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-1" aria-hidden />
        Retour au catalogue
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <motion.div
          className="mx-auto w-full max-w-xs lg:max-w-none"
          initial={{ opacity: 0, y: 40, rotate: -4 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 16 }}
        >
          <img
            src={data.cover}
            alt={`Couverture de ${data.title}`}
            className="aspect-2/3 w-full object-cover shadow-lift"
          />
        </motion.div>

        <motion.div variants={cascade} initial="hidden" animate="visible">
          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3">
            <Link
              to={`/catalogue?categorie=${data.category.slug}`}
              className="bg-brand px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-ink"
            >
              {data.category.name}
            </Link>
            {isNew(data.published_at) && (
              <span className="bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white">
                Nouveau
              </span>
            )}
          </motion.div>

          <motion.h1 variants={fadeUp} className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
            {data.title}
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-3 text-lg text-muted">
            par <span className="font-bold text-ink">{data.author}</span>
          </motion.p>

          <motion.div variants={fadeUp} className="mt-5 flex items-center gap-3 text-sm">
            {data.rating_average === null ? (
              <span className="text-muted">Pas encore de note</span>
            ) : (
              <>
                <Stars value={data.rating_average} />
                <span className="font-bold">{formatRating(data.rating_average)}</span>
                <span className="text-muted">
                  ({data.rating_count} {data.rating_count > 1 ? "notes" : "note"})
                </span>
              </>
            )}
          </motion.div>

          <motion.div variants={fadeUp} className="mt-8 max-w-md border border-line bg-white p-6 shadow-card">
            <PriceTag price={data.price} className={data.is_free ? "text-sm" : "text-3xl"} />
            <div className="mt-5">
              <MainAction book={data} owned={owned} />
            </div>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              {facts.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <Icon className="size-4 shrink-0 text-brand-strong" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.section variants={fadeUp} className="mt-10">
            <h2 className="text-xl font-bold">À propos de ce livre</h2>
            <p className="mt-3 max-w-2xl whitespace-pre-line leading-relaxed text-muted">{data.description}</p>
          </motion.section>

          <motion.section variants={fadeUp} className="mt-10 max-w-md bg-canvas p-6">
            <h2 className="text-lg font-bold">Votre avis compte</h2>
            <p className="mt-1 text-sm text-muted">Vos étoiles aident les autres lecteurs à choisir.</p>
            <div className="mt-4">
              <RatingInput book={data} owned={owned} />
            </div>
          </motion.section>
        </motion.div>
      </div>

      {others.length > 0 && (
        <section className="mt-24">
          <Reveal>
            <h2 className="mb-8 text-2xl font-bold">Dans la même catégorie</h2>
          </Reveal>
          <Reveal stagger className={BOOK_GRID}>
            {others.map((other) => (
              <BookCard key={other.slug} book={other} />
            ))}
          </Reveal>
        </section>
      )}
    </div>
  );
}
