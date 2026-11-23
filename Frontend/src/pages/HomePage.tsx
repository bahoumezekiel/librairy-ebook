import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CreditCard,
  type LucideIcon,
  Search,
  ServerCog,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { animate, motion, useInView } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { CatalogBook } from "@/api/types";
import { BUTTON_BASE, VARIANTS } from "@/components/Button";
import { fadeUp, Reveal } from "@/components/motion";
import { BOOK_GRID, BookCard, BookCardSkeleton } from "@/features/public/BookCard";
import { useBooks, useCategories } from "@/features/public/data";
import { Hero } from "@/features/public/Hero";
import { formatNumber } from "@/lib/format";

const SECTION = "mx-auto max-w-7xl px-4 py-20 sm:px-8";
const SHELF_SIZE = 4;

/** Icône d'une catégorie, choisie d'après les mots de son adresse. */
const CATEGORY_ICONS: [string, LucideIcon][] = [
  ["science", BrainCircuit],
  ["analys", BarChart3],
  ["secur", ShieldCheck],
  ["backend", ServerCog],
];
const categoryIcon = (slug: string) =>
  CATEGORY_ICONS.find(([keyword]) => slug.includes(keyword))?.[1] ?? BookOpen;

const STEPS = [
  { icon: Search, title: "Trouvez votre livre", text: "Parcourez les catégories ou cherchez un titre, un auteur, un sujet." },
  { icon: CreditCard, title: "Téléchargez ou achetez", text: "Les livres gratuits se téléchargent aussitôt. Les autres se paient par Mobile Money ou par carte." },
  { icon: WifiOff, title: "Lisez partout", text: "Vos livres achetés restent dans votre bibliothèque, lisibles même sans connexion." },
];

/** Nombre qui compte jusqu'à sa valeur quand il entre dans l'écran. */
function Counter({ value }: { value: number }) {
  const element = useRef<HTMLSpanElement>(null);
  const visible = useInView(element, { once: true });
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const controls = animate(0, value, { duration: 1.2, ease: "easeOut", onUpdate: setDisplayed });
    return () => controls.stop();
  }, [visible, value]);

  return <span ref={element}>{formatNumber(displayed)}</span>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-strong">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
      </div>
      {action}
    </Reveal>
  );
}

function SeeAll({ to }: { to: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2 text-sm font-bold text-brand-strong">
      Tout voir
      <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}

/** Rangée de livres qui apparaissent en cascade, ou cartes grises pendant le chargement. */
function Shelf({ books }: { books: CatalogBook[] | undefined }) {
  return (
    <Reveal stagger className={BOOK_GRID}>
      {books
        ? books.slice(0, SHELF_SIZE).map((book) => <BookCard key={book.slug} book={book} />)
        : Array.from({ length: SHELF_SIZE }, (_, index) => <BookCardSkeleton key={index} />)}
    </Reveal>
  );
}

export function HomePage() {
  const latest = useBooks();
  const topRated = useBooks({ sort: "rating" });
  const free = useBooks({ is_free: "true" });
  const categories = useCategories();
  // Seuls les livres réellement notés figurent dans « les mieux notés ».
  const rated = topRated.data?.results.filter((book) => book.rating_count > 0);
  const catalogueIsEmpty = latest.data?.count === 0;

  const figures = [
    { label: "livres au catalogue", value: latest.data?.count },
    { label: "livres gratuits", value: free.data?.count },
    { label: "catégories", value: categories.data?.length },
  ];

  return (
    <>
      <Hero />

      <section className="border-b border-line bg-white">
        <Reveal stagger className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-line px-4 sm:px-8">
          {figures.map(({ label, value }) => (
            <motion.div key={label} variants={fadeUp} className="px-2 py-8 text-center text-brand">
              <p className="text-3xl font-bold tabular-nums sm:text-5xl">
                {value === undefined ? "–" : <Counter value={value} />}
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] sm:text-sm">{label}</p>
            </motion.div>
          ))}
        </Reveal>
      </section>

      {Boolean(categories.data?.length) && (
        <section className={SECTION}>
          <SectionTitle eyebrow="Explorer" title="Choisissez votre domaine" />
          <Reveal stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {categories.data?.map((category) => {
              const Icon = categoryIcon(category.slug);
              return (
                <motion.div key={category.slug} variants={fadeUp}>
                  <Link
                    to={`/catalogue?categorie=${category.slug}`}
                    className="group flex h-full flex-col border border-line bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-ink hover:bg-ink hover:text-white hover:shadow-lift"
                  >
                    <span className="grid size-14 place-items-center bg-brand text-ink">
                      <Icon className="size-7" aria-hidden />
                    </span>
                    <h3 className="mt-6 text-lg font-bold">{category.name}</h3>
                    <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted transition-colors duration-300 group-hover:text-white/70">
                      {category.description || "Découvrir les livres de cette catégorie."}
                    </p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-strong transition-colors duration-300 group-hover:text-brand">
                      Voir les livres
                      <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </Reveal>
        </section>
      )}

      {catalogueIsEmpty ? (
        <section className="bg-canvas">
          <Reveal className={`${SECTION} text-center`}>
            <span className="mx-auto grid size-14 place-items-center bg-brand text-ink">
              <BookOpen className="size-7" aria-hidden />
            </span>
            <h2 className="mt-6 text-3xl font-bold">Les premiers livres arrivent bientôt</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              Le catalogue est en cours de préparation. Créez un compte pour être prévenu dès qu'un
              livre est publié.
            </p>
          </Reveal>
        </section>
      ) : (
        <section className="bg-canvas">
          <div className={SECTION}>
            <SectionTitle eyebrow="Nouveautés" title="Les derniers livres publiés" action={<SeeAll to="/catalogue" />} />
            <Shelf books={latest.data?.results} />
          </div>
        </section>
      )}

      {rated && rated.length > 0 && (
        <section className={SECTION}>
          <SectionTitle
            eyebrow="Plébiscités"
            title="Les mieux notés par les lecteurs"
            action={<SeeAll to="/catalogue?tri=rating" />}
          />
          <Shelf books={rated} />
        </section>
      )}

      <section className={rated?.length ? "bg-canvas" : "bg-white"}>
        <div className={SECTION}>
          <SectionTitle eyebrow="Simple" title="Comment ça marche" />
          <Reveal stagger className="grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }) => (
              <motion.div key={title} variants={fadeUp} className="border border-line bg-white p-8">
                <span className="grid size-14 place-items-center bg-ink text-brand">
                  <Icon className="size-7" aria-hidden />
                </span>
                <h3 className="mt-6 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </motion.div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className={SECTION}>
        <Reveal className="relative overflow-hidden bg-ink px-6 py-16 text-center text-white sm:px-16">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-brand/30 blur-3xl" aria-hidden />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-bold sm:text-4xl">
            Prêt à progresser ? Votre prochain livre vous attend.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/75">
            Créez un compte gratuit pour acheter vos livres et les garder dans votre bibliothèque.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/inscription" className={`${BUTTON_BASE} ${VARIANTS.primary} h-13 px-7 text-base`}>
              Créer un compte
            </Link>
            <Link to="/catalogue" className={`${BUTTON_BASE} ${VARIANTS.onDark} h-13 px-7 text-base`}>
              Parcourir le catalogue
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
