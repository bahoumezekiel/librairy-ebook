import {
  BookOpen,
  ChevronRight,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import type { User } from "@/api/types";
import { Logo } from "@/components/Logo";
import { fadeUp } from "@/components/motion";
import { useLogout, useSession } from "@/features/auth/session";

/** Sections de l'interface admin, dans l'ordre du menu. */
const NAVIGATION = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/admin/livres", label: "Livres", icon: BookOpen },
  { to: "/admin/categories", label: "Catégories", icon: FolderTree },
  { to: "/admin/commandes", label: "Commandes", icon: ShoppingBag },
  { to: "/admin/clients", label: "Clients", icon: Users },
  { to: "/admin/messages", label: "Messages", icon: Mail },
  { to: "/admin/newsletter", label: "Newsletter", icon: Newspaper },
];

/** Le choix « menu replié » est gardé d'une visite à l'autre sur cet appareil. */
// Simple confort : si le navigateur refuse le stockage, le menu reste déplié.
const readPreference = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writePreference = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // stockage indisponible : la préférence n'est pas mémorisée
  }
};
const COLLAPSED_KEY = "fasolib:menu-replie";

const initials = (user: User) => (user.first_name[0] + user.last_name[0]).toUpperCase();
const TOPBAR_BUTTON =
  "size-10 place-items-center rounded-xl text-muted transition-colors duration-150 hover:bg-canvas hover:text-ink";

interface SidebarProps {
  /** Replié : seules les icônes restent visibles. */
  collapsed?: boolean;
  /** Identifiant d'animation du repère de la section active, propre à chaque menu affiché. */
  markerId: string;
  onNavigate?: () => void;
}

function Sidebar({ collapsed = false, markerId, onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Même hauteur et même filet que l'en-tête, pour une ligne continue en haut de l'écran. */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-line ${collapsed ? "justify-center" : "px-6"}`}
      >
        {collapsed ? (
          <span
            className="grid size-10 place-items-center rounded-xl bg-brand text-lg font-bold text-ink"
            aria-label="FasoLib"
          >
            F
          </span>
        ) : (
          <Logo />
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 pt-4" aria-label="Sections">
        {!collapsed && (
          <p className="px-3 pb-2 text-xs font-bold uppercase tracking-widest text-muted">
            Administration
          </p>
        )}
        {NAVIGATION.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            aria-label={label}
            className={({ isActive }) =>
              `relative flex h-11 items-center gap-3 rounded-xl text-sm transition-colors duration-150 ${
                collapsed ? "justify-center" : "px-3"
              } ${isActive ? "font-bold text-brand-strong" : "text-muted hover:bg-canvas hover:text-ink"}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId={markerId}
                    className="absolute inset-0 rounded-xl bg-brand-soft"
                    transition={{ duration: 0.25 }}
                  />
                )}
                <Icon className="relative size-5 shrink-0" aria-hidden />
                {!collapsed && <span className="relative truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

interface TopbarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenDrawer: () => void;
}

/** En-tête : repli du menu, section en cours, profil de l'administrateur et déconnexion. */
function Topbar({ collapsed, onToggleCollapsed, onOpenDrawer }: TopbarProps) {
  const { pathname } = useLocation();
  const { data: user } = useSession();
  const logout = useLogout();
  const section = NAVIGATION.find(({ to, end }) => (end ? pathname === to : pathname.startsWith(to)));
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Ouvrir le menu"
        className={`grid lg:hidden ${TOPBAR_BUTTON}`}
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
        title={collapsed ? "Déplier le menu" : "Replier le menu"}
        aria-expanded={!collapsed}
        className={`hidden lg:grid ${TOPBAR_BUTTON}`}
      >
        <CollapseIcon className="size-5" aria-hidden />
      </button>

      <p className="flex min-w-0 items-center gap-2 text-sm">
        <span className="hidden text-muted sm:inline">Administration</span>
        <ChevronRight className="hidden size-4 text-muted sm:inline" aria-hidden />
        <span className="truncate font-bold">{section?.label}</span>
      </p>

      {user && (
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong ring-2 ring-white">
              {initials(user)}
            </span>
            <span className="hidden min-w-0 md:block">
              <span className="block max-w-48 truncate text-sm font-bold capitalize">
                {user.first_name} {user.last_name}
              </span>
              <span className="block text-xs text-muted">Administrateur</span>
            </span>
          </div>
          <span className="h-8 w-px bg-line" aria-hidden />
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            aria-label="Se déconnecter"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-bold text-ink transition-colors duration-150 hover:border-danger/30 hover:bg-danger-soft hover:text-danger disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="hidden sm:inline">Se déconnecter</span>
          </button>
        </div>
      )}
    </header>
  );
}

/** Structure de l'interface admin : menu latéral repliable, en-tête et contenu de la section. */
export function AdminLayout() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readPreference(COLLAPSED_KEY) === "1");

  const toggleCollapsed = () => {
    writePreference(COLLAPSED_KEY, collapsed ? "0" : "1");
    setCollapsed(!collapsed);
  };

  return (
    <div
      className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-20" : "lg:pl-64"}`}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-line transition-[width] duration-200 lg:block ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <Sidebar collapsed={collapsed} markerId="nav-desktop" />
      </aside>

      <Topbar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-ink/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Sidebar markerId="nav-mobile" onNavigate={() => setDrawerOpen(false)} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
                className={`absolute right-3 top-3 grid ${TOPBAR_BUTTON}`}
              >
                <X className="size-5" aria-hidden />
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-10">
        {/* La clé relance l'animation d'entrée à chaque changement de section. */}
        <motion.div key={pathname} variants={fadeUp} initial="hidden" animate="visible">
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
