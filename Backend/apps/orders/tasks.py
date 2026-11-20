"""Tâches Celery : traitement des notifications et rattrapage des paiements en attente."""

from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .gateway import GatewayError
from .models import Order, Payment, WebhookEvent
from .services import sync_payment

# Délai laissé à la notification avant que la tâche de rattrapage n'interroge Genius Pay.
PENDING_GRACE = timedelta(minutes=5)
# Au-delà, une commande toujours en attente est considérée comme abandonnée. Elle reste
# payable si le prestataire confirme plus tard le paiement (voir `sync_payment`).
ORDER_TIMEOUT = timedelta(hours=48)


@shared_task(autoretry_for=(GatewayError,), retry_backoff=True, max_retries=5)
def process_webhook_event(event_pk, reference):
    """Traite une notification : relit le paiement concerné, puis marque l'événement traité."""
    payment = Payment.objects.filter(reference=reference).first()
    if payment:
        sync_payment(payment)
    WebhookEvent.objects.filter(pk=event_pk).update(processed_at=timezone.now())


@shared_task
def sync_pending_payments():
    """
    Rattrape les notifications perdues en relisant les paiements restés en attente,
    puis clôt les commandes abandonnées, qui ne sont plus interrogées ensuite.
    """
    now = timezone.now()
    stale = Payment.objects.filter(
        order__status=Order.Status.PENDING, order__created_at__lt=now - PENDING_GRACE
    )
    for payment in stale:
        try:
            sync_payment(payment)
        except GatewayError:
            continue  # déjà journalisé par la passerelle ; nouvel essai au prochain passage
    Order.objects.filter(status=Order.Status.PENDING, created_at__lt=now - ORDER_TIMEOUT).update(
        status=Order.Status.EXPIRED
    )
