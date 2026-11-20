import { useMutation } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { api, errorMessage } from "@/api/client";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { useOrder } from "@/features/public/data";
import { formatMoney } from "@/lib/format";

const OUTCOMES = [
  { outcome: "completed", label: "Payer (paiement réussi)", variant: "primary" },
  { outcome: "failed", label: "Faire échouer le paiement", variant: "secondary" },
  { outcome: "cancelled", label: "Annuler le paiement", variant: "secondary" },
] as const;

/**
 * Page de paiement simulée, pour le développement uniquement.
 * Elle tient la place de la page Genius Pay tant que les clés du prestataire manquent,
 * et n'existe que si l'API a activé `GENIUSPAY_SIMULATION`.
 */
export function SimulatedPaymentPage() {
  const { reference = "" } = useParams();
  const [params] = useSearchParams();
  const orderId = params.get("commande") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const order = useOrder(orderId);

  const settle = useMutation({
    mutationFn: (outcome: string) =>
      api(`/simulation/payments/${reference}/`, { method: "POST", body: { outcome } }),
    onSuccess: () => navigate(`/commandes/${orderId}`, { replace: true }),
    onError: (error) => toast("error", errorMessage(error)),
  });

  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-16">
      <div className="w-full max-w-md border border-line bg-white p-10 shadow-card">
        <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-strong">
          <FlaskConical className="size-4" aria-hidden />
          Paiement simulé – développement
        </p>
        <h1 className="mt-5 text-2xl font-bold">Choisissez l'issue du paiement</h1>
        <p className="mt-2 text-sm text-muted">
          Aucun argent n'est débité. En production, cette page est remplacée par celle de Genius Pay.
        </p>
        <dl className="mt-6 space-y-2 bg-canvas p-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Référence</dt>
            <dd className="font-mono text-xs">{reference}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Montant</dt>
            <dd className="font-bold">{order.data ? formatMoney(order.data.amount) : "…"}</dd>
          </div>
        </dl>
        <div className="mt-6 space-y-3">
          {OUTCOMES.map(({ outcome, label, variant }) => (
            <Button
              key={outcome}
              variant={variant}
              className="w-full"
              loading={settle.isPending && settle.variables === outcome}
              disabled={settle.isPending}
              onClick={() => settle.mutate(outcome)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
