/**
 * Bibliothèque hors ligne, rangée dans IndexedDB.
 *
 * Chaque livre est conservé chiffré, avec sa clé de déchiffrement sous forme de
 * `CryptoKey` non exportable : le navigateur peut s'en servir, mais aucun script
 * ne peut en lire la valeur. Le texte en clair n'est jamais enregistré.
 */

import { type DBSchema, openDB } from "idb";

export interface OfflineBook {
  slug: string;
  /** Compte qui a acheté le livre : seul lui peut l'ouvrir sur cet appareil. */
  ownerId: string;
  title: string;
  author: string;
  cover: string;
  format: "pdf" | "epub";
  /** Texte du filigrane affiché par-dessus un EPUB (les PDF ont déjà le leur). */
  watermark: string;
  encrypted: ArrayBuffer;
  key: CryptoKey;
  /** Fin de validité de la licence hors ligne, au format ISO. */
  expiresAt: string;
  savedAt: string;
}

/** Informations d'un livre hors ligne, sans le fichier ni la clé (pour les listes). */
export type OfflineBookSummary = Omit<OfflineBook, "encrypted" | "key">;

interface LibrarySchema extends DBSchema {
  books: { key: string; value: OfflineBook };
}

const database = openDB<LibrarySchema>("fasolib", 1, {
  upgrade(db) {
    db.createObjectStore("books", { keyPath: "slug" });
  },
});

export const isLicenseValid = (book: Pick<OfflineBook, "expiresAt">) =>
  new Date(book.expiresAt).getTime() > Date.now();

export async function getOfflineBook(slug: string) {
  return (await database).get("books", slug);
}

export async function saveOfflineBook(book: OfflineBook) {
  await (await database).put("books", book);
}

/** Met à jour la date de fin de licence d'un livre déjà enregistré. */
export async function extendLicense(slug: string, expiresAt: string) {
  const db = await database;
  const book = await db.get("books", slug);
  if (book) await db.put("books", { ...book, expiresAt });
}

export async function deleteOfflineBook(slug: string) {
  await (await database).delete("books", slug);
}

/** Livres hors ligne, sans leurs fichiers. */
export async function listOfflineBooks(): Promise<OfflineBookSummary[]> {
  const books = await (await database).getAll("books");
  return books.map(({ encrypted: _encrypted, key: _key, ...summary }) => summary);
}

/**
 * Retire les livres d'un autre compte que `ownerId`, ou tous les livres sans `ownerId`.
 * Appelé à la déconnexion et à la connexion d'un autre compte sur le même appareil.
 */
export async function clearOfflineBooks(ownerId?: string) {
  const db = await database;
  const transaction = db.transaction("books", "readwrite");
  for (const book of await transaction.store.getAll()) {
    if (book.ownerId !== ownerId) await transaction.store.delete(book.slug);
  }
  await transaction.done;
}

/**
 * Demande au navigateur de ne pas effacer ces données quand l'espace manque.
 * Sans effet si le navigateur refuse ; les livres restent re-téléchargeables.
 */
export async function requestPersistentStorage() {
  return navigator.storage?.persist?.() ?? false;
}

/** Espace occupé par le site sur l'appareil, en octets. */
export async function usedStorage() {
  return (await navigator.storage?.estimate?.())?.usage ?? 0;
}
