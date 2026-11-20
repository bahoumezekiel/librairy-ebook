"""Vues des commandes d'un client : lancer un achat et suivre son statut."""

from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import Order
from .serializers import CreatedOrderSerializer, OrderSerializer
from .services import place_order, refresh_pending_order


class OrderViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Un client ne crée et ne consulte que ses propres commandes."""

    queryset = Order.objects.select_related("book", "payment")
    throttle_scope = "orders"

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def get_serializer_class(self):
        return CreatedOrderSerializer if self.action == "create" else OrderSerializer

    def get_throttles(self):
        # La création appelle Genius Pay à chaque fois : elle est limitée par client.
        # Le suivi l'appelle aussi, mais se limite lui-même (voir `refresh_pending_order`),
        # et la page de suivi doit rester consultable sans restriction.
        return [ScopedRateThrottle()] if self.action == "create" else []

    def perform_create(self, serializer):
        serializer.instance = place_order(self.request.user, serializer.validated_data["book"])

    def retrieve(self, request, *args, **kwargs):
        """Confirme la commande même si la notification du prestataire s'est perdue."""
        order = refresh_pending_order(self.get_object())
        return Response(self.get_serializer(order).data)
