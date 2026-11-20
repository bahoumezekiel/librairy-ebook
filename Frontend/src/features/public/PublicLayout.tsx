import { ChevronDown, LayoutDashboard, LibraryBig, LogOut, Menu, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import type { User } from "@/api/types";
import { BUTTON_BASE, VARIANTS } from "@/components/Button";
import { Dropdown } from "@/components/Dropdown";
import { Logo } from "@/components/Logo";
import { fadeUp } from "@/components/motion";
import { useLogout, useSession } from "@/features/auth/session";

import { Footer } from "./Footer";
import { NotificationBell } from "./NotificationBell";

const NAVIGATION = [
  { to: "/", label: "Accueil", end: true },
  { to: "/catalogue", label: "Catalogue" },
];

const MENU_ITEM =
  "flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition-colors duration-150 hover:bg-canvas";

/** Menu du compte connecté : bibliothèque, interface admin (administrateur), déconnexion. */
function AccountMenu({ user }: { user: User }) {
  const logout = useLogout();
  return (
    <Dropdown
      label="Mon compte"
      trigger={(open) => (
        <span className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors duration-150 hover:bg-canvas">
          <span className="grid size-9 place-items-center rounded-full bg-ink text-xs font-bold text-white">
            {(user.first_name[0] + user.last_name[0]).toUpperCase()}
          </span>
          <ChevronDown
            className={`size-4 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-line px-5 py-4">
            <p className="truncate text-sm font-bold capitalize">
              {user.first_name} {user.last_name}
            </p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link to="/bibliotheque" onClick={close} className={MENU_ITEM}>
            <LibraryBig className="size-4 text-muted" aria-hidden />
            Ma bibliothèque
          </Link>
          {user.is_staff && (
            <Link to="/admin" onClick={close} className={MENU_ITEM}>
              <LayoutDashboard className="size-4 text-muted" aria-hidden />
              Administration
            </Link>
          )}
          <button
            type="button"
            onClick={() => logout.mutate()}
            className={`${MENU_ITEM} border-t border-line text-danger`}
          >
            <LogOut className="size-4" aria-hidden />
            Se déconnecter
          </button>
        </>
      )}
    </Dropdown>
  );
}

function Header() {
  const { data: user } = useSession();
  const { pathname } = useLocation();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));
  // Le menu du téléphone se referme quand on change de page.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-30 border-b bg-white/85 backdrop-blur-md transition-shadow duration-200 ${
        scrolled ? "border-line shadow-card" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-6 px-4 sm:px-8">
        <Link to="/" className="rounded-lg" aria-label="FasoLib, accueil">
          <Logo className="text-[1.75rem]" />
        </Link>

        <nav className="hidden items-center gap-2 md:ml-8 md:flex lg:ml-14" aria-label="Navigation principale">
          {NAVIGATION.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative rounded-lg px-3.5 py-2 text-base transition-colors duration-150 ${
                  isActive ? "font-bold text-ink" : "text-muted hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {label}
                  {isActive && (
                    <motion.span
                      layoutId="public-nav"
                      className="absolute inset-x-3.5 -bottom-1 h-0.5 rounded-full bg-brand"
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <AccountMenu user={user} />
            </>
          ) : (
            <>
              {/* Sur téléphone, « Connexion » est dans le menu déroulant. */}
              <Link
                to="/connexion"
                className="hidden h-11 items-center rounded-xl px-4 text-base font-bold text-ink transition-colors duration-150 hover:bg-canvas sm:flex"
              >
                Connexion
              </Link>
              <Link
                to="/inscription"
                className={`${BUTTON_BASE} ${VARIANTS.primary} h-11 whitespace-nowrap px-5 text-base`}
              >
                Créer un compte
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            className="grid size-10 place-items-center rounded-xl text-ink hover:bg-canvas md:hidden"
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            className="border-t border-line bg-white px-4 py-3 md:hidden"
            aria-label="Navigation principale"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {[...NAVIGATION, ...(user ? [] : [{ to: "/connexion", label: "Connexion", end: false }])].map(
              ({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `block rounded-xl px-4 py-3 text-sm ${isActive ? "bg-brand-soft font-bold text-brand-strong" : "text-ink"}`
                  }
                >
                  {label}
                </NavLink>
              ),
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

/** Structure de l'espace public : en-tête, page en cours, pied de page. */
export function PublicLayout() {
  const { pathname } = useLocation();

  // Chaque nouvelle page s'ouvre en haut, sans défilement animé.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <motion.main key={pathname} className="flex-1" variants={fadeUp} initial="hidden" animate="visible">
        <Outlet />
      </motion.main>
      <Footer />
    </div>
  );
}
