"""
Passerelle de paiement.

Seul module qui connaît le SDK Genius Pay : le reste du code ne manipule que
`RemotePayment` et `GatewayError`, ce qui permet de changer de prestataire ici.
"""

import logging
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from django.conf import settings
from geniuspay.client import GeniusPayClient
from geniuspay.exceptions import GeniusPayError
from rest_framework import status
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


class GatewayError(APIException):
    """Le prestataire de paiement est injoignable ou a refusé la requête."""

    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "Le service de paiement est momentanément indisponible. Réessayez plus tard."
    default_code = "payment_unavailable"


@dataclass(frozen=True)
class RemotePayment:
    """État d'un paiement tel que le prestataire le déclare."""

    reference: str
    status: str
    amount: Decimal | None
    currency: str
    url: str | None
    raw: dict


def _simulation():
    """Module de simulation, chargé à la demande car il dépend de celui-ci."""
    from . import simulation

    return simulation


def create_payment(order):
    """Crée le paiement d'une commande et renvoie sa référence et son URL de paiement."""
    if settings.GENIUSPAY_SIMULATION:
        return _simulation().create_payment(order)
    return_url = f"{settings.FRONTEND_URL}/commandes/{order.id}"
    return _call(
        lambda client: client.payments.create(
            amount=order.amount,
            currency=settings.CURRENCY,
            description=f"Achat du livre « {order.book.title} »"[:500],
            customer={
                "name": f"{order.user.first_name} {order.user.last_name}",
                "email": order.user.email,
            },
            success_url=return_url,
            error_url=return_url,
            metadata={"order_id": str(order.id)},
        )
    )


def fetch_payment(reference):
    """Relit un paiement auprès du prestataire, seule source fiable de son statut."""
    if settings.GENIUSPAY_SIMULATION:
        return _simulation().fetch_payment(reference)
    return _call(lambda client: client.payments.retrieve(reference))


def _call(operation):
    try:
        payment = operation(GeniusPayClient())
    except GeniusPayError as exc:
        logger.exception("Appel à Genius Pay en échec")
        raise GatewayError() from exc
    return RemotePayment(
        reference=payment.reference,
        # À la création, Genius Pay ne renvoie pas encore de statut (vérifié en sandbox) :
        # un paiement tout juste créé est en attente.
        status=payment.status or "pending",
        amount=_to_decimal(payment.amount),
        currency=payment.currency,
        url=payment.checkout_url or payment.payment_url,
        raw=payment._raw,  # réponse complète : le SDK ne l'expose pas autrement
    )


def _to_decimal(amount):
    try:
        return Decimal(str(amount))
    except InvalidOperation:
        return None
