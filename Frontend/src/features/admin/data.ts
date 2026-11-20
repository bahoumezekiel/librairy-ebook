/** Accès aux données de l'interface admin : listes mises en cache et modifications. */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "@/api/client";
import { toQuery } from "@/lib/format";

type Params = Record<string, string | number | undefined>;

/**
 * Charge une liste de /api/admin/{resource}/ avec ses filtres.
 * Pendant un changement de page ou de filtre, l'ancienne liste reste affichée.
 */
export function useAdminList<T>(resource: string, params: Params = {}) {
  return useQuery({
    queryKey: ["admin", resource, params],
    queryFn: () => api<T>(`/admin/${resource}/${toQuery(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** Modification côté admin : après un succès, toutes les données admin sont rechargées. */
export function useAdminMutation<TVariables, TResult = unknown>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

/** Renvoie `value` une fois qu'elle n'a plus changé pendant `delayMs` (saisie de recherche). */
export function useDebounced<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
