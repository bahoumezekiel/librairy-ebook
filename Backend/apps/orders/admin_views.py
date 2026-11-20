"""Vues du back-office : commandes, paiements et indicateurs du tableau de bord."""

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order
from .serializers import AdminOrderSerializer, StatsQuerySerializer
from .stats import dashboard_stats


class AdminOrderListView(generics.ListAPIView):
    """Toutes les commandes, de la plus récente à la plus ancienne ; filtre `status`."""

    queryset = Order.objects.select_related("user", "book", "payment")
    serializer_class = AdminOrderSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status"]


class AdminStatsView(APIView):
    """Indicateurs du tableau de bord : chiffre d'affaires, commandes, clients, livres."""

    permission_classes = [IsAdminUser]

    @extend_schema(parameters=[StatsQuerySerializer], responses=OpenApiTypes.OBJECT)
    def get(self, request):
        query = StatsQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        stats = dashboard_stats(query.validated_data["days"])
        stats["recent_orders"] = AdminOrderSerializer(stats["recent_orders"], many=True).data
        return Response(stats)
