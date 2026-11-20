import { lazy, type ReactNode, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";

import { AuthLayout } from "@/features/auth/AuthLayout";
import { RequireAdmin } from "@/features/auth/RequireAdmin";
import { RequireAuth, SessionLoader } from "@/features/auth/RequireAuth";
import { PublicLayout } from "@/features/public/PublicLayout";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { BookPage } from "@/pages/BookPage";
import { CatalogPage } from "@/pages/CatalogPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { HomePage } from "@/pages/HomePage";
import { LibraryPage } from "@/pages/LibraryPage";
import { LoginPage } from "@/pages/LoginPage";
import { OrderPage } from "@/pages/OrderPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SimulatedPaymentPage } from "@/pages/SimulatedPaymentPage";

/**
 * Pages chargées seulement quand on y va. Leur contenu est tout de même enregistré sur
 * l'appareil par le service worker, donc le lecteur s'ouvre aussi sans réseau.
 */
const page = <T extends string>(load: () => Promise<Record<T, () => ReactNode>>, name: T) =>
  lazy(() => load().then((module) => ({ default: module[name] })));

// Le lecteur embarque PDF.js et epub.js : près d'un mégaoctet que les visiteurs du site
// public n'ont aucune raison de télécharger tant qu'ils n'ouvrent pas un livre acheté.
const ReaderPage = page(() => import("@/pages/ReaderPage"), "ReaderPage");

// L'interface admin est chargée à part : les visiteurs du site public ne la téléchargent pas.
const AdminLayout = lazy(() =>
  import("@/features/admin/AdminLayout").then((module) => ({ default: module.AdminLayout })),
);
const DashboardPage = page(() => import("@/pages/admin/DashboardPage"), "DashboardPage");
const BooksPage = page(() => import("@/pages/admin/BooksPage"), "BooksPage");
const CategoriesPage = page(() => import("@/pages/admin/CategoriesPage"), "CategoriesPage");
const OrdersPage = page(() => import("@/pages/admin/OrdersPage"), "OrdersPage");
const ClientsPage = page(() => import("@/pages/admin/ClientsPage"), "ClientsPage");
const MessagesPage = page(() => import("@/pages/admin/MessagesPage"), "MessagesPage");
const SubscribersPage = page(() => import("@/pages/admin/SubscribersPage"), "SubscribersPage");

const signedIn = (node: ReactNode) => <RequireAuth>{node}</RequireAuth>;
/** Page accessible sans réseau, avec les seuls livres enregistrés sur l'appareil. */
const signedInOrOffline = (node: ReactNode) => <RequireAuth allowOffline>{node}</RequireAuth>;

/** Attente sur fond sombre, le temps que le lecteur se charge : il occupe tout l'écran. */
const ReaderLoader = () => (
  <div className="fixed inset-0 grid place-items-center bg-[#1b2230]" role="status" aria-label="Chargement" />
);

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/catalogue", element: <CatalogPage /> },
      { path: "/livres/:slug", element: <BookPage /> },
      { path: "/bibliotheque", element: signedInOrOffline(<LibraryPage />) },
      { path: "/commandes/:id", element: signedIn(<OrderPage />) },
      { path: "/paiement-simule/:reference", element: signedIn(<SimulatedPaymentPage />) },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "/connexion", element: <LoginPage /> },
      { path: "/inscription", element: <RegisterPage /> },
      { path: "/mot-de-passe-oublie", element: <ForgotPasswordPage /> },
    ],
  },
  // Arrivée du lien reçu par e-mail. Hors d'`AuthLayout`, qui renvoie ailleurs un
  // utilisateur déjà connecté : il doit pouvoir changer son mot de passe quand même.
  { path: "/mot-de-passe/:uid/:token", element: <ResetPasswordPage /> },
  // Lecteur en plein écran, hors de la mise en page du site.
  {
    path: "/lire/:slug",
    element: signedInOrOffline(
      <Suspense fallback={<ReaderLoader />}>
        <ReaderPage />
      </Suspense>,
    ),
  },
  { path: "/admin/connexion", element: <AdminLoginPage /> },
  {
    path: "/admin",
    element: (
      <RequireAdmin>
        <Suspense fallback={<SessionLoader />}>
          <AdminLayout />
        </Suspense>
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "livres", element: <BooksPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "commandes", element: <OrdersPage /> },
      { path: "clients", element: <ClientsPage /> },
      { path: "messages", element: <MessagesPage /> },
      { path: "newsletter", element: <SubscribersPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
