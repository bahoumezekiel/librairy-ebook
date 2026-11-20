/** Identité de l'appareil, déclarée au serveur pour la limite de 3 appareils par achat. */

const DEVICE_KEY = "fasolib:appareil";

/** Identifiant de secours quand le navigateur refuse le stockage (navigation privée stricte). */
let sessionDeviceId: string | null = null;

/** Identifiant tiré au hasard la première fois, puis conservé sur cet appareil. */
export function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    sessionDeviceId ??= crypto.randomUUID();
    return sessionDeviceId;
  }
}

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone|iPad/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

const match = (rules: [RegExp, string][], fallback: string) =>
  rules.find(([pattern]) => pattern.test(navigator.userAgent))?.[1] ?? fallback;

/** Nom lisible de l'appareil, par exemple « Chrome sur Android ». */
export function deviceName() {
  return `${match(BROWSERS, "Navigateur")} sur ${match(SYSTEMS, "appareil inconnu")}`;
}
