/**
 * Déchiffrement des livres achetés, avec l'API Web Crypto du navigateur.
 *
 * Format du fichier chiffré par le serveur (AES-256-GCM) :
 * `nonce (12 octets) || texte chiffré || étiquette d'authentification (16 octets)`.
 */

const NONCE_SIZE = 12;

/** Transforme la clé reçue en base64 en clé utilisable seulement pour déchiffrer, non exportable. */
export function importBookKey(base64Key: string) {
  const raw = Uint8Array.from(atob(base64Key), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

/**
 * Déchiffre un livre en mémoire. Échoue si le fichier a été modifié ou si la clé ne convient pas :
 * l'étiquette GCM garantit l'intégrité du contenu.
 */
export function decryptBook(encrypted: ArrayBuffer, key: CryptoKey) {
  const nonce = encrypted.slice(0, NONCE_SIZE);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, encrypted.slice(NONCE_SIZE));
}
