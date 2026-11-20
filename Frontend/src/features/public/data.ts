/** Accès aux données de l'espace public : catalogue, bibliothèque, notes, nouveautés. */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/api/client";
import type {
  BookNotification,
  CatalogBook,
  CatalogCategory,
  ClientOrder,
  Paginated,
  Purchase,
} from "@/api/types";
import { useSession } from "@/features/auth/session";
import { toQuery } from "@/lib/format";

export interface BookFilters {
  search?: string;
  category?: string;
  /** « true » : gratuits, « false » : payants. */
  is_free?: string;
  sort?: string;
  page?: number;
}

/**
 * Liste de livres du catalogue. `enabled` sert aux listes dont le filtre n'est pas encore
 * connu (les livres de la même catégorie, par exemple) : sans lui, une première requête
 * sans filtre partirait pour rien.
 */
export function useBooks(filters: BookFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["books", filters],
    queryFn: () => api<Paginated<CatalogBook>>(`/books/${toQuery({ ...filters })}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useBook(slug: string) {
  return useQuery({
    queryKey: ["books", slug],
    queryFn: () => api<CatalogBook>(`/books/${slug}/`),
    retry: false,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api<CatalogCategory[]>("/categories/"),
    staleTime: 5 * 60_000,
  });
}

/** Livres achetés par le client connecté ; vide pour un visiteur. */
export function useLibrary() {
  const { data: user } = useSession();
  return useQuery({
    queryKey: ["library"],
    // Liste complète (non paginée par l'API).
    queryFn: () => api<Purchase[]>("/library/"),
    enabled: Boolean(user),
    // Tant qu'une copie personnelle est en préparation, on redemande son état.
    refetchInterval: ({ state }) => (state.data?.some((p) => !p.is_ready) ? 3000 : false),
  });
}

/** Nouveautés annoncées au client connecté. */
export function useNotifications() {
  const { data: user } = useSession();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<BookNotification[]>("/notifications/"),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/notifications/read/", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/** Note du client connecté pour un livre, `null` s'il ne l'a pas encore noté. */
export function useMyRating(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: ["rating", slug],
    queryFn: async () => {
      try {
        return (await api<{ stars: number }>(`/books/${slug}/rating/`)).stars;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled,
  });
}

/** Donne (`stars`) ou retire (`null`) la note du client, puis rafraîchit le livre. */
export function useRate(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stars: number | null) =>
      stars === null
        ? api<void>(`/books/${slug}/rating/`, { method: "DELETE" })
        : api(`/books/${slug}/rating/`, { method: "PUT", body: { stars } }),
    onSuccess: (_, stars) => {
      queryClient.setQueryData(["rating", slug], stars);
      return queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

/** Lance l'achat d'un livre payant : crée la commande et renvoie l'adresse de paiement. */
export function usePlaceOrder() {
  return useMutation({
    mutationFn: (slug: string) =>
      api<ClientOrder>("/orders/", { method: "POST", body: { book: slug } }),
  });
}

const FINAL_STATUSES = new Set(["paid", "failed", "cancelled", "expired"]);
const POLL_EVERY_MS = 2000;
/** Au-delà de 10 minutes d'attente, on cesse d'interroger le serveur en boucle. */
const MAX_POLLS = 300;

/**
 * Suit une commande ; tant qu'elle est en attente, son statut est redemandé au serveur.
 * `stalled` passe à vrai si l'attente dure trop : la page propose alors d'actualiser.
 */
export function useOrder(id: string) {
  const queryClient = useQueryClient();
  const order = useQuery({
    queryKey: ["orders", id],
    queryFn: () => api<ClientOrder>(`/orders/${id}/`),
    refetchInterval: ({ state }) =>
      (state.data && FINAL_STATUSES.has(state.data.status)) || state.dataUpdateCount >= MAX_POLLS
        ? false
        : POLL_EVERY_MS,
    retry: false,
  });
  const polls = queryClient.getQueryState(["orders", id])?.dataUpdateCount ?? 0;
  return { ...order, stalled: order.data?.status === "pending" && polls >= MAX_POLLS };
}
