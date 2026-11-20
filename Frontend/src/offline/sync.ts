/**
 * Mise à disposition hors ligne d'un livre acheté.
 *
 * 1. Le serveur vérifie l'achat et la limite d'appareils, puis renvoie la clé et la fin de licence.
 * 2. Le fichier chiffré est téléchargé une seule fois et rangé dans IndexedDB avec la clé.
 * 3. Les ouvertures suivantes, en ligne, ne font que renouveler la licence.
 */

import { api, apiBinary } from "@/api/client";
import type { Purchase, User } from "@/api/types";

import { importBookKey } from "./crypto";
import { deviceId, deviceName } from "./device";
import { extendLicense, getOfflineBook, type OfflineBook, requestPersistentStorage, saveOfflineBook } from "./store";

interface License {
  key: string;
  expires_at: string;
}

const requestLicense = (slug: string) =>
  api<License>(`/library/${slug}/license/`, {
    method: "POST",
    body: { device_id: deviceId(), name: deviceName() },
  });

/**
 * Renvoie le livre prêt à être ouvert : téléchargé si l'appareil ne l'a pas encore,
 * sinon simplement avec sa licence renouvelée.
 */
export async function syncBook(purchase: Purchase, user: User): Promise<OfflineBook> {
  const { book } = purchase;
  const license = await requestLicense(book.slug);
  const stored = await getOfflineBook(book.slug);
  if (stored && stored.ownerId === user.id) {
    await extendLicense(book.slug, license.expires_at);
    return { ...stored, expiresAt: license.expires_at };
  }

  const [encrypted, key] = await Promise.all([
    apiBinary(`/library/${book.slug}/file/`),
    importBookKey(license.key),
  ]);
  const offline: OfflineBook = {
    slug: book.slug,
    ownerId: user.id,
    title: book.title,
    author: book.author,
    cover: book.cover,
    format: book.format,
    watermark: `Exemplaire personnel de ${user.first_name} ${user.last_name} – ${user.email}`,
    encrypted,
    key,
    expiresAt: license.expires_at,
    savedAt: new Date().toISOString(),
  };
  await saveOfflineBook(offline);
  void requestPersistentStorage();
  return offline;
}
