/** Mise en forme des nombres et des dates, en français. */

const number = new Intl.NumberFormat("fr-FR");
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact" });
const shortDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const longDay = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const oneDecimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Note moyenne : « 4,3 ». */
export const formatRating = (value: number) => oneDecimal.format(value);

export const formatNumber = (value: number) => number.format(Math.round(value));
export const formatCompact = (value: number) => compact.format(value);
export const formatMoney = (value: number) => `${formatNumber(value)} FCFA`;

/** « 2026-11-10 » devient « 10 nov. ». */
export const formatShortDay = (isoDate: string) => shortDay.format(new Date(isoDate));
export const formatLongDay = (date: Date) => longDay.format(date);

const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** « 10 nov. 2026 » */
export const formatDate = (iso: string) => date.format(new Date(iso));
/** « 10 nov. 2026, 14:03 » */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** Construit « ?a=1&b=2 » en ignorant les valeurs vides. */
export function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** « 14:03 » */
export const formatTime = (timestamp: number) => time.format(new Date(timestamp));

/** Part de `part` dans `total`, en pourcentage entier (0 si le total est nul). */
export const percentOf = (part: number, total: number) =>
  total === 0 ? 0 : Math.round((part / total) * 100);

/** « 42 % » */
export const formatPercent = (part: number, total: number) => `${percentOf(part, total)} %`;
