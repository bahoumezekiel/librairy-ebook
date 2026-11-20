/**
 * Prépare un livre acheté pour la lecture : en ligne, licence renouvelée (et fichier
 * téléchargé la première fois) ; hors ligne, exemplaire enregistré sur l'appareil.
 * Le contenu est déchiffré en mémoire seulement, et oublié dès que l'on quitte le lecteur.
 */

import { useQuery } from "@tanstack/react-query";

import { api, ApiError, isNetworkError } from "@/api/client";
import type { Purchase, User } from "@/api/types";
import { useSession } from "@/features/auth/session";
import { decryptBook } from "@/offline/crypto";
import { deleteOfflineBook, getOfflineBook, isLicenseValid, type OfflineBook } from "@/offline/store";
import { syncBook } from "@/offline/sync";

/** Erreur à présenter au lecteur, avec un titre et une explication. */
export class ReaderError extends Error {
  constructor(
    readonly title: string,
    readonly text: string,
    /** Vrai si réessayer a une chance d'aboutir (exemplaire en préparation, réseau). */
    readonly retryable = false,
  ) {
    super(title);
  }
}

const SERVER_ERRORS: Record<string, ReaderError> = {
  copy_not_ready: new ReaderError(
    "Votre exemplaire est en préparation",
    "Il sera prêt dans quelques instants. Réessayez dans un moment.",
    true,
  ),
  device_limit_reached: new ReaderError(
    "Limite d'appareils atteinte",
    "Ce livre est déjà ouvert sur 3 appareils. Une place se libère dès que l'un d'eux reste un mois sans l'ouvrir.",
  ),
};

async function fromServer(slug: string, user: User) {
  try {
    const purchase = await api<Purchase>(`/library/${slug}/`);
    return await syncBook(purchase, user);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      // Achat absent (ou retiré) : l'exemplaire éventuellement enregistré n'a plus lieu d'être.
      await deleteOfflineBook(slug);
      throw new ReaderError("Livre introuvable", "Ce livre ne fait pas partie de votre bibliothèque.");
    }
    if (error instanceof ApiError) throw SERVER_ERRORS[error.code] ?? error;
    throw error;
  }
}

async function fromDevice(slug: string): Promise<OfflineBook> {
  const stored = await getOfflineBook(slug);
  if (!stored) {
    throw new ReaderError(
      "Livre non disponible hors ligne",
      "Ouvrez ce livre une première fois avec une connexion internet pour pouvoir le lire ensuite sans réseau.",
      true,
    );
  }
  if (!isLicenseValid(stored)) {
    // Le livre reste acquis : seule l'autorisation de le lire sans réseau est à renouveler.
    throw new ReaderError(
      "Une connexion est nécessaire",
      "Ce livre est bien à vous. Ouvrez-le une fois avec internet pour pouvoir le relire ensuite sans réseau.",
      true,
    );
  }
  return stored;
}

export function useReadableBook(slug: string) {
  const session = useSession();
  const user = session.data;
  const offline = Boolean(session.error && isNetworkError(session.error));

  const readable = useQuery({
    queryKey: ["reader", slug, user?.id ?? "hors-ligne"],
    enabled: Boolean(user) || offline,
    queryFn: async () => {
      let book: OfflineBook;
      try {
        book = user ? await fromServer(slug, user) : await fromDevice(slug);
      } catch (error) {
        // Le réseau a lâché en cours de route : on se rabat sur l'exemplaire de l'appareil.
        if (user && isNetworkError(error)) book = await fromDevice(slug);
        else throw error;
      }
      try {
        return { book, content: await decryptBook(book.encrypted, book.key), offline: !user };
      } catch {
        await deleteOfflineBook(slug);
        throw new ReaderError(
          "Exemplaire illisible",
          "Le fichier enregistré sur cet appareil est endommagé. Il sera téléchargé à nouveau à la prochaine ouverture en ligne.",
          true,
        );
      }
    },
    retry: false,
    // Doit s'exécuter même hors ligne : l'exemplaire est alors lu depuis l'appareil.
    networkMode: "always",
    staleTime: Infinity,
    // Le texte déchiffré ne reste pas en mémoire une fois le lecteur fermé.
    gcTime: 0,
  });

  /**
   * Nouvel essai. Hors ligne, c'est la session qui est revérifiée d'abord : si le réseau est revenu,
   * le livre est rouvert depuis le serveur et sa licence renouvelée.
   */
  const retry = () => void (offline ? session.refetch() : readable.refetch());
  return { ...readable, retry };
}
