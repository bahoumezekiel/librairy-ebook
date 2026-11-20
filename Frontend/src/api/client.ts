/**
 * Client HTTP de l'API FasoLib.
 *
 * Le jeton d'accès ne vit qu'en mémoire. Le jeton de renouvellement reste dans
 * un cookie HttpOnly que JavaScript ne peut pas lire : quand l'API répond 401,
 * on demande un nouveau jeton d'accès puis on rejoue la requête une fois.
 */

const API_ROOT = "/api";

/** Erreur renvoyée par l'API, au format unique `{ code, message, errors? }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Détail par champ, présent pour les erreurs de validation. */
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshInProgress: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

function send(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(API_ROOT + path, { ...init, headers });
}

/** Obtient un jeton d'accès grâce au cookie. Les appels simultanés partagent la même requête. */
export function refreshSession(): Promise<boolean> {
  refreshInProgress ??= send("/auth/refresh/", { method: "POST" })
    .then(async (response) => {
      accessToken = response.ok ? (await response.json()).access : null;
      return response.ok;
    })
    .finally(() => {
      refreshInProgress = null;
    });
  return refreshInProgress;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Objet envoyé en JSON, ou `FormData` pour un envoi de fichiers. */
  body?: unknown;
}

/** Envoie la requête, renouvelle la session si besoin, et lève une `ApiError` en cas d'échec. */
async function request(path: string, { method = "GET", body }: RequestOptions) {
  const init: RequestInit =
    body instanceof FormData || body === undefined
      ? { method, body }
      : { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } };

  let response = await send(path, init);
  if (response.status === 401 && accessToken && (await refreshSession())) {
    response = await send(path, init);
  }
  if (!response.ok) {
    // Une erreur peut venir d'un intermédiaire (proxy, serveur web) sans réponse JSON.
    const data = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      data?.code ?? "server_error",
      data?.message ?? `Le serveur a répondu par une erreur (${response.status}). Réessayez.`,
      data?.errors,
    );
  }
  return response;
}

/** Appel JSON de l'API. */
export async function api<T>(path: string, options: RequestOptions = {}) {
  const response = await request(path, options);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Téléchargement d'un fichier binaire de l'API (par exemple un livre chiffré). */
export async function apiBinary(path: string) {
  return (await request(path, {})).arrayBuffer();
}

/**
 * Vrai si l'appel a échoué faute de réseau, et non parce que le serveur a refusé.
 * Sert à basculer en lecture hors ligne. `fetch` signale l'absence de réseau par une `TypeError`.
 */
export const isNetworkError = (error: unknown) => error instanceof TypeError;

/**
 * Message à montrer à l'utilisateur quand un appel échoue : celui de l'API quand elle a
 * répondu, sinon le seul fait certain, à savoir que le serveur n'a pas été joint.
 */
export const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : "Connexion au serveur impossible. Réessayez.";
