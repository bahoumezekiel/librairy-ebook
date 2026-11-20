import { CircleX, Clock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useParams } from "react-router";

import type { OrderStatus } from "@/api/types";
import { BUTTON_BASE, VARIANTS } from "@/components/Button";
import { useOrder } from "@/features/public/data";
import { formatMoney } from "@/lib/format";

const FAILURES: Partial<Record<OrderStatus, { title: string; text: string }>> = {
  failed: { title: "Le paiement a échoué", text: "Aucun montant n'a été validé. Vous pouvez réessayer." },
  cancelled: { title: "Paiement annulé", text: "Vous avez annulé le paiement. Vous pouvez réessayer quand vous voulez." },
  expired: { title: "Le délai de paiement est dépassé", text: "La commande a expiré avant le paiement. Vous pouvez la relancer." },
};

/** Anneau qui tourne pendant que le serveur attend la confirmation du paiement. */
function Waiting() {
  return (
    <motion.span
      className="block size-20 rounded-full border-4 border-line border-t-brand"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      aria-hidden
    />
  );
}

/** Pastille verte dont la coche se dessine quand le paiement est confirmé. */
function Success() {
  return (
    <motion.span
      className="grid size-20 place-items-center rounded-full bg-leaf text-white"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        />
      </svg>
    </motion.span>
  );
}

/**
 * Suivi d'une commande au retour du paiement.
 * Le livre n'est accordé que lorsque le serveur a confirmé le paiement : cette page
 * se contente de lui redemander le statut jusqu'à ce qu'il soit définitif.
 */
export function OrderPage() {
  const { id = "" } = useParams();
  const order = useOrder(id);
  const status = order.data?.status;
  const failure = status && FAILURES[status];
  const bookLink = order.data && `/livres/${order.data.book}`;

  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-16">
      <div className="w-full max-w-md border border-line bg-white p-10 text-center shadow-card">
        <AnimatePresence mode="wait">
          <motion.div
            key={order.isError ? "error" : (status ?? "loading")}
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            role="status"
          >
            {order.isError ? (
              <>
                <CircleX className="size-16 text-danger" aria-hidden />
                <h1 className="mt-6 text-2xl font-bold">Commande introuvable</h1>
                <p className="mt-2 text-sm text-muted">Cette commande n'existe pas ou n'est pas la vôtre.</p>
                <Link to="/catalogue" className={`${BUTTON_BASE} ${VARIANTS.primary} mt-8`}>
                  Retour au catalogue
                </Link>
              </>
            ) : status === "paid" ? (
              <>
                <Success />
                <h1 className="mt-6 text-2xl font-bold">Paiement confirmé</h1>
                <p className="mt-2 text-sm text-muted">
                  Merci ! Votre livre a été ajouté à votre bibliothèque.
                </p>
                <Link to="/bibliotheque" className={`${BUTTON_BASE} ${VARIANTS.primary} mt-8`}>
                  Ouvrir ma bibliothèque
                </Link>
              </>
            ) : failure ? (
              <>
                <CircleX className="size-16 text-danger" aria-hidden />
                <h1 className="mt-6 text-2xl font-bold">{failure.title}</h1>
                <p className="mt-2 text-sm text-muted">{failure.text}</p>
                <Link to={bookLink ?? "/catalogue"} className={`${BUTTON_BASE} ${VARIANTS.primary} mt-8`}>
                  Revenir au livre
                </Link>
              </>
            ) : order.stalled ? (
              <>
                <Clock className="size-16 text-brand" aria-hidden />
                <h1 className="mt-6 text-2xl font-bold">Paiement toujours en attente</h1>
                <p className="mt-2 text-sm text-muted">
                  La confirmation prend plus de temps que prévu. Si vous avez bien payé, votre livre
                  apparaîtra dans votre bibliothèque dès que le paiement sera confirmé.
                </p>
                <button type="button" onClick={() => void order.refetch()} className={`${BUTTON_BASE} ${VARIANTS.primary} mt-8`}>
                  Actualiser
                </button>
              </>
            ) : (
              <>
                <Waiting />
                <h1 className="mt-6 text-2xl font-bold">Confirmation du paiement…</h1>
                <p className="mt-2 text-sm text-muted">
                  Nous attendons la confirmation de votre paiement. Cette page se met à jour toute
                  seule, vous n'avez rien à faire.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {order.data && (
          <p className="mt-8 border-t border-line pt-6 text-sm text-muted">
            Montant de la commande :{" "}
            <span className="font-bold text-ink">{formatMoney(order.data.amount)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
