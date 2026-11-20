import { ArrowLeft, BellRing, LibraryBig, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import { Logo } from "@/components/Logo";
import { cascade, EASE_OUT, fadeUp } from "@/components/motion";
import { useBooks } from "@/features/public/data";

import { RedirectSignedIn } from "./fields";
import { SessionLoader } from "./RequireAuth";
import { useSession } from "./session";

const TABS = [
  { to: "/connexion", label: "Connexion" },
  { to: "/inscription", label: "Inscription" },
];

const BENEFITS = [
  { icon: LibraryBig, title: "Tous vos livres au même endroit", text: "Chaque livre acheté rejoint votre bibliothèque personnelle." },
  { icon: WifiOff, title: "Lisibles sans connexion", text: "Continuez à lire même quand le réseau est instable." },
  { icon: BellRing, title: "Prévenu des nouveautés", text: "Une notification dès qu'un nouveau livre est publié." },
];

/** Nombre minimal de couvertures pour remplir le bandeau défilant. */
const MIN_COVERS = 4;

/**
 * Écrans de connexion et d'inscription de l'espace public.
 * Le cadre reste en place quand on passe d'un onglet à l'autre : seul le formulaire change.
 */
export function AuthLayout() {
  const session = useSession();
  const { pathname, state } = useLocation();
  const covers = useBooks().data?.results ?? [];

  if (session.isPending) return <SessionLoader />;
  if (session.data) return <RedirectSignedIn user={session.data} />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-white">
      {/* Halos de lumière qui dérivent lentement. */}
      <motion.div
        className="absolute -left-48 -top-56 size-136 rounded-full bg-brand/20 blur-3xl"
        animate={{ x: [0, 70, 0], y: [0, 50, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="absolute -bottom-64 right-1/4 size-152 rounded-full bg-[#2a4fa8]/40 blur-3xl"
        animate={{ x: [0, -60, 0], y: [0, -40, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_30rem]">
        {/* min-w-0 : le bandeau de couvertures, très large, ne doit pas élargir cette colonne. */}
        <motion.div className="hidden min-w-0 lg:block" variants={cascade} initial="hidden" animate="visible">
          <motion.div variants={fadeUp}>
            <Link to="/" aria-label="FasoLib, accueil">
              <Logo onDark className="text-3xl" />
            </Link>
          </motion.div>
          <motion.p variants={fadeUp} className="mt-12 max-w-lg text-5xl font-bold leading-[1.1] tracking-tight">
            Votre bibliothèque technique, <span className="text-brand">toujours avec vous.</span>
          </motion.p>
          <ul className="mt-12 space-y-7">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <motion.li key={title} variants={fadeUp} className="flex items-start gap-5">
                <span className="grid size-12 shrink-0 place-items-center bg-brand text-ink">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span>
                  <span className="block font-bold">{title}</span>
                  <span className="mt-1 block text-sm text-white/65">{text}</span>
                </span>
              </motion.li>
            ))}
          </ul>

          {covers.length >= MIN_COVERS && (
            <motion.div
              variants={fadeUp}
              className="mt-14 overflow-hidden mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
              aria-hidden
            >
              {/* La liste est doublée : quand la première moitié est sortie, la boucle reprend sans saut. */}
              <motion.div
                className="flex w-max gap-4"
                animate={{ x: ["0%", "-50%"] }}
                transition={{ duration: covers.length * 5, repeat: Infinity, ease: "linear" }}
              >
                {[...covers, ...covers].map((book, index) => (
                  <img key={index} src={book.cover} alt="" className="h-36 w-24 object-cover ring-1 ring-white/10" />
                ))}
              </motion.div>
            </motion.div>
          )}
        </motion.div>

        <motion.main
          className="mx-auto w-full max-w-lg bg-white p-8 text-ink shadow-lift sm:p-10"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          <Link to="/" className="mb-8 inline-block lg:hidden" aria-label="FasoLib, accueil">
            <Logo className="text-3xl" />
          </Link>

          <nav className="grid grid-cols-2 border-b border-line" aria-label="Connexion ou inscription">
            {TABS.map(({ to, label }) => (
              // La page d'origine est transmise, pour y revenir une fois connecté.
              <NavLink
                key={to}
                to={to}
                state={state}
                replace
                className={({ isActive }) =>
                  `relative pb-4 text-center text-sm font-bold uppercase tracking-[0.18em] transition-colors duration-150 ${
                    isActive ? "text-ink" : "text-muted hover:text-ink"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {label}
                    {isActive && (
                      <motion.span
                        layoutId="auth-tab"
                        className="absolute inset-x-0 -bottom-px h-0.5 bg-brand"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <motion.div
            key={pathname}
            className="mt-8"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <Outlet />
          </motion.div>

          <Link
            to="/"
            className="group mt-8 inline-flex items-center gap-2 text-sm text-muted transition-colors duration-150 hover:text-ink"
          >
            <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-1" aria-hidden />
            Retour au site
          </Link>
        </motion.main>
      </div>
    </div>
  );
}
