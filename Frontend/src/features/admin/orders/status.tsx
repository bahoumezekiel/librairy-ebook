import { Ban, CircleCheck, CircleX, Clock, type LucideIcon, TimerOff } from "lucide-react";

import type { OrderStatus } from "@/api/types";

interface StatusStyle {
  key: OrderStatus;
  label: string;
  plural: string;
  icon: LucideIcon;
  /** Couleur de fond pleine (barres), de texte et de fond clair (badges). */
  bar: string;
  text: string;
  soft: string;
}

/** Chaque statut a une icône et un libellé : la couleur n'est jamais le seul repère. */
export const ORDER_STATUSES: StatusStyle[] = [
  { key: "paid", label: "Payée", plural: "Payées", icon: CircleCheck, bar: "bg-leaf", text: "text-leaf-strong", soft: "bg-leaf-soft" },
  { key: "pending", label: "En attente", plural: "En attente", icon: Clock, bar: "bg-brand", text: "text-brand-strong", soft: "bg-brand-soft" },
  { key: "failed", label: "Échouée", plural: "Échouées", icon: CircleX, bar: "bg-danger", text: "text-danger", soft: "bg-danger-soft" },
  { key: "cancelled", label: "Annulée", plural: "Annulées", icon: Ban, bar: "bg-gray-500", text: "text-gray-600", soft: "bg-gray-100" },
  { key: "expired", label: "Expirée", plural: "Expirées", icon: TimerOff, bar: "bg-gray-300", text: "text-gray-500", soft: "bg-gray-100" },
];

const BY_KEY = Object.fromEntries(ORDER_STATUSES.map((status) => [status.key, status])) as Record<
  OrderStatus,
  StatusStyle
>;

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, icon: Icon, text, soft } = BY_KEY[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${soft} ${text}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
