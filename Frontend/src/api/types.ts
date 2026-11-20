/** Types des réponses de l'API utilisées par l'interface. */

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
}

/** Liste paginée renvoyée par l'API (20 éléments par page). */
export interface Paginated<T> {
  count: number;
  results: T[];
}

export const PAGE_SIZE = 20;

export interface Category {
  name: string;
  slug: string;
  description: string;
  position: number;
}

export interface Book {
  slug: string;
  title: string;
  author: string;
  description: string;
  /** URL publique de la couverture. */
  cover: string;
  /** Slug de la catégorie. */
  category: string;
  format: "pdf" | "epub";
  is_free: boolean;
  /** Prix en FCFA, `null` pour un livre gratuit. */
  price: number | null;
  is_published: boolean;
  /** Note moyenne sur 5, `null` tant que le livre n'a aucune note. */
  rating_average: number | null;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

/** Catégorie telle que la voit le public. */
export type CatalogCategory = Omit<Category, "position">;

/** Livre du catalogue public. */
export interface CatalogBook {
  slug: string;
  title: string;
  author: string;
  description: string;
  cover: string;
  category: CatalogCategory;
  format: "pdf" | "epub";
  is_free: boolean;
  price: number | null;
  /** Date de première publication. */
  published_at: string;
  rating_average: number | null;
  rating_count: number;
}

/** Livre acheté, dans la bibliothèque du client. */
export interface Purchase {
  book: Omit<CatalogBook, "rating_average" | "rating_count">;
  purchased_at: string;
  /** Vrai quand la copie personnelle chiffrée est prête à être lue. */
  is_ready: boolean;
}

/** Commande vue par le client qui l'a passée. */
export interface ClientOrder {
  id: string;
  /** Slug du livre. */
  book: string;
  amount: number;
  status: OrderStatus;
  created_at: string;
  paid_at: string | null;
  /** Page de paiement, renvoyée uniquement à la création. */
  payment_url?: string;
}

/** Annonce d'un nouveau livre. */
export interface BookNotification {
  book: Purchase["book"];
  published_at: string;
  is_read: boolean;
}

/** Message reçu par le formulaire de contact. */
export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
}

/** Adresse inscrite à la newsletter. */
export interface Subscriber {
  id: number;
  email: string;
  subscribed_at: string;
}

export interface Client {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

export interface Order {
  id: string;
  /** E-mail du client. */
  client: string;
  /** Titre du livre. */
  book: string;
  amount: number;
  status: OrderStatus;
  created_at: string;
  paid_at: string | null;
  payment_reference: string | null;
  payment_status: string | null;
}

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "expired";

export interface DailyRevenue {
  /** Jour au format AAAA-MM-JJ. */
  date: string;
  revenue: number;
  orders: number;
}

export interface TopBook {
  slug: string;
  title: string;
  sales: number;
  revenue: number;
}

export interface TopRatedBook {
  slug: string;
  title: string;
  rating_average: number;
  rating_count: number;
}

/** Réponse de GET /api/admin/stats/. */
/** Valeur d'un indicateur sur la période choisie et sur la période précédente de même durée. */
export interface Evolution {
  current: number;
  previous: number;
}

export type PeriodDays = 7 | 30 | 90;

export interface DashboardStats {
  currency: string;
  period: { days: PeriodDays; start: string; end: string };
  /** `total` : depuis le lancement de la plateforme. */
  revenue: Evolution & { total: number };
  paid_orders: Evolution & { total: number };
  new_clients: Evolution & { total: number };
  /** Commandes lancées pendant la période, et combien ont abouti à un paiement. */
  conversion: { created: Evolution; paid: Evolution };
  /** Commandes lancées pendant la période, par statut. */
  orders_by_status: Record<OrderStatus, number>;
  books: { free: number; paid: number };
  daily_revenue: DailyRevenue[];
  top_books: TopBook[];
  top_rated: TopRatedBook[];
  recent_orders: Order[];
}
