/** Session de l'utilisateur : restauration au chargement, connexion et déconnexion. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, refreshSession, setAccessToken } from "@/api/client";
import type { User } from "@/api/types";
import { clearOfflineBooks } from "@/offline/store";

const SESSION_KEY = ["session"];

const fetchProfile = () => api<User>("/auth/me/");

/**
 * Utilisateur connecté, ou `null`. La session est restaurée grâce au cookie de renouvellement.
 * Sans réseau, la requête échoue (`isError`) : les pages de lecture passent alors en mode hors ligne.
 */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => ((await refreshSession()) ? fetchProfile() : null),
    staleTime: Infinity,
    retry: false,
    // Hors ligne, la vérification doit échouer (et non attendre le réseau) pour basculer en lecture locale.
    networkMode: "always",
    // Une session en échec n'est pas relancée à chaque composant affiché (sinon la page boucle
    // entre chargement et erreur) ; elle l'est quand le réseau revient.
    retryOnMount: false,
    refetchOnReconnect: true,
  });
}

interface Credentials {
  email: string;
  password: string;
}

async function signIn(credentials: Credentials) {
  const { access } = await api<{ access: string }>("/auth/login/", {
    method: "POST",
    body: credentials,
  });
  setAccessToken(access);
  const user = await fetchProfile();
  // Les livres hors ligne d'un autre compte ne restent pas sur l'appareil.
  await clearOfflineBooks(user.id);
  return user;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signIn,
    onSuccess: (user) => queryClient.setQueryData(SESSION_KEY, user),
  });
}

/** Crée un compte client, puis le connecte aussitôt. */
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (account: Credentials & { first_name: string; last_name: string }) => {
      await api("/auth/register/", { method: "POST", body: account });
      return signIn(account);
    },
    onSuccess: (user) => queryClient.setQueryData(SESSION_KEY, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout/", { method: "POST" }),
    onSettled: async () => {
      setAccessToken(null);
      // Après déconnexion, plus aucun livre ne reste lisible sur cet appareil.
      await clearOfflineBooks();
      queryClient.setQueryData(SESSION_KEY, null);
      // Aucune donnée de l'ancien utilisateur ne doit rester en cache.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
    },
  });
}
