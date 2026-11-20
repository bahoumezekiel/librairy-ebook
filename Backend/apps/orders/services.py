"""
Règles métier des commandes.

L'accès à un livre payant n'est accordé qu'ici, dans `sync_payment`, après
relecture du paiement auprès du prestataire : jamais sur la foi d'une
notification ni du retour du client sur le site.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.library.models import Purchase
from apps.library.tasks import prepare_purchase_copy
from config.exceptions import Conflict

from . import gateway
from .models import Order, Payment

logger = logging.getLogger(__name__)

# Statuts Genius Pay qui clôturent une commande. Les autres (pending, processing…)
# la laissent en attente.
FINAL_STATUSES = {
    "paid": Order.Status.PAID,
    "completed": Order.Status.PAID,
    "failed": Order.Status.FAILED,
    "cancelled": Order.Status.CANCELLED,
    "expired": Order.Status.EXPIRED,
}

# Intervalle minimal entre deux relectures d'un paiement demandées par la page de suivi.
REFRESH_INTERVAL = timedelta(seconds=10)


def place_order(user, book):
    """
    Lance l'achat d'un livre payant.

    Renvoie la commande, enrichie de `payment_url` vers laquelle rediriger le client.
    Une commande du même livre encore en attente est reprise au lieu d'être doublée.
    """
    resumed = _resume_pending_order(user, book)
    # Contrôle fait après la reprise : celle-ci a pu constater un paiement déjà abouti,
    # qui vient d'accorder le livre au client.
    if Purchase.objects.filter(user=user, book=book).exists():
        raise Conflict("Vous possédez déjà ce livre.")
    if resumed:
        return resumed

    order = Order.objects.create(user=user, book=book, amount=book.price)
    try:
        remote = gateway.create_payment(order)
    except gateway.GatewayError:
        order.status = Order.Status.FAILED
        order.save(update_fields=["status"])
        raise
    Payment.objects.create(
        order=order, reference=remote.reference, status=remote.status, raw_response=remote.raw
    )
    order.payment_url = remote.url
    return order


def _resume_pending_order(user, book):
    """
    Renvoie la commande en attente du même livre si son paiement est encore ouvert.

    Un client qui reclique sur « Acheter » ouvrirait sinon un second paiement, qu'il
    pourrait régler en plus du premier : il faudrait alors le rembourser. Renvoie `None`
    s'il n'y a rien à reprendre, auquel cas l'appelant crée une commande.
    """
    pending = (
        Order.objects.filter(
            user=user, book=book, status=Order.Status.PENDING, payment__isnull=False
        )
        .select_related("book", "payment")
        .first()
    )
    if pending is None:
        return None

    try:
        remote = gateway.fetch_payment(pending.payment.reference)
    except gateway.GatewayError:
        return None  # paiement introuvable chez le prestataire : on en ouvre un neuf

    if remote.status not in FINAL_STATUSES and remote.url:
        pending.payment_url = remote.url
        return pending
    # Paiement déjà conclu, ou sans page de paiement : la commande est mise à jour avec
    # l'état que le prestataire vient de donner, sans le redemander.
    _apply_remote_state(pending.payment, remote)
    return None


def sync_payment(payment):
    """
    Aligne une commande sur l'état réel de son paiement, relu auprès du prestataire.

    Sans effet si la commande est déjà clôturée : la fonction peut être appelée
    plusieurs fois (notifications répétées, tâche de rattrapage) sans risque.
    """
    _apply_remote_state(payment, gateway.fetch_payment(payment.reference))


def _apply_remote_state(payment, remote):
    """Enregistre l'état `remote` du paiement et en tire les conséquences sur la commande."""
    with transaction.atomic():
        # Verrou : deux traitements simultanés ne peuvent pas clôturer la même commande.
        order = Order.objects.select_for_update().get(pk=payment.order_id)
        payment.status, payment.raw_response = remote.status, remote.raw
        payment.save(update_fields=["status", "raw_response", "updated_at"])

        new_status = FINAL_STATUSES.get(remote.status)
        # Une commande expirée de notre côté (délai dépassé) reste payable : si le prestataire
        # confirme finalement le paiement, le client a payé et doit recevoir son livre.
        late_payment = order.status == Order.Status.EXPIRED and new_status == Order.Status.PAID
        if new_status is None or (order.status != Order.Status.PENDING and not late_payment):
            return

        if new_status == Order.Status.PAID:
            if remote.amount != order.amount or remote.currency != settings.CURRENCY:
                logger.error(
                    "Paiement %s : %s %s reçus pour une commande de %s %s",
                    payment.reference,
                    remote.amount,
                    remote.currency,
                    order.amount,
                    settings.CURRENCY,
                )
                new_status = Order.Status.FAILED
            else:
                order.paid_at = timezone.now()
                purchase, created = Purchase.objects.get_or_create(
                    user_id=order.user_id, book_id=order.book_id, defaults={"order": order}
                )
                if created:
                    # La copie personnelle est préparée une fois l'achat enregistré en base.
                    transaction.on_commit(lambda: prepare_purchase_copy.delay(purchase.pk))
                else:
                    # Deux commandes du même livre payées : la seconde est à rembourser.
                    logger.warning(
                        "Commande %s : livre déjà acheté par ce client, paiement %s à rembourser",
                        order.id,
                        payment.reference,
                    )

        order.status = new_status
        order.save(update_fields=["status", "paid_at"])
        logger.info("Commande %s : %s", order.id, new_status)


def refresh_pending_order(order):
    """
    Relit le paiement d'une commande en attente, au plus une fois toutes les 10 secondes.

    La page de suivi interroge la commande en boucle : cette relecture la confirme en
    quelques secondes même si la notification du prestataire s'est perdue, sans pour
    autant appeler Genius Pay à chaque interrogation.

    La date de relecture est posée *avant* l'appel et sert de verrou : deux onglets
    ouverts sur la même commande ne déclenchent qu'une relecture, et un prestataire
    en panne n'est pas sollicité en boucle.
    """
    if order.status != Order.Status.PENDING:
        return order

    now = timezone.now()
    # Mise à jour conditionnelle : elle ne touche aucune ligne si la relecture est trop
    # récente, ou si la commande n'a pas encore de paiement.
    reserved = Payment.objects.filter(
        order_id=order.id, updated_at__lt=now - REFRESH_INTERVAL
    ).update(updated_at=now)
    if not reserved:
        return order

    try:
        sync_payment(order.payment)
    except gateway.GatewayError:
        return order  # déjà journalisé par la passerelle ; nouvel essai au prochain appel
    order.refresh_from_db()
    return order
