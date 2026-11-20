"""
Genius Pay simulé, pour le développement.

Tant que les clés sandbox manquent, ce module remplace le prestataire : le
client est envoyé sur une page du site qui lui laisse choisir l'issue du
paiement. Le reste du parcours (relecture du paiement, commande, achat) est le
vrai code. Actif uniquement si `GENIUSPAY_SIMULATION` vaut vrai, ce que les
réglages interdisent hors mode DEBUG.
"""

import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.cache import cache
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .gateway import GatewayError, RemotePayment
from .models import Payment
from .serializers import OrderSerializer
from .services import sync_payment

KEEP_FOR = timedelta(days=7)


def create_payment(order):
    return _store(f"SIM-{uuid.uuid4().hex[:12].upper()}", "pending", order.amount, order.id)


def fetch_payment(reference):
    payment = cache.get(_key(reference))
    if payment is None:
        raise GatewayError()
    return payment


def _store(reference, status, amount, order_id):
    payment = RemotePayment(
        reference=reference,
        status=status,
        amount=Decimal(amount),
        currency=settings.CURRENCY,
        url=f"{settings.FRONTEND_URL}/paiement-simule/{reference}?commande={order_id}",
        raw={"simulation": True, "status": status, "order_id": str(order_id)},
    )
    cache.set(_key(reference), payment, KEEP_FOR.total_seconds())
    return payment


def _key(reference):
    return f"simulation:payment:{reference}"


class SimulatedOutcomeSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=["completed", "failed", "cancelled"])


class SimulatedPaymentView(APIView):
    """Fixe l'issue d'un paiement simulé du client connecté, puis synchronise sa commande."""

    @extend_schema(request=SimulatedOutcomeSerializer, responses=OrderSerializer)
    def post(self, request, reference):
        if not settings.GENIUSPAY_SIMULATION:
            raise NotFound()
        payment = get_object_or_404(Payment, reference=reference, order__user=request.user)
        outcome = SimulatedOutcomeSerializer(data=request.data)
        outcome.is_valid(raise_exception=True)

        _store(reference, outcome.validated_data["outcome"], payment.order.amount, payment.order_id)
        sync_payment(payment)
        payment.order.refresh_from_db()
        return Response(OrderSerializer(payment.order).data)
