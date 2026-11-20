"""Vues de la bibliothèque personnelle : livres achetés, licence d'appareil, fichier chiffré."""

from django.http import FileResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Purchase
from .serializers import DeviceLicenseSerializer, PurchaseSerializer
from .services import ensure_copy_ready, issue_license


class LibraryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Bibliothèque du client connecté : la liste complète de ses achats, ou un achat précis.

    Chaque route part de ses propres achats : un livre non acheté répond 404.
    """

    queryset = Purchase.objects.select_related("book__category")
    lookup_field = "book__slug"
    lookup_url_kwarg = "book"
    # Liste non paginée : une page partielle ferait croire à l'absence des livres suivants.
    pagination_class = None

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def get_serializer_class(self):
        return DeviceLicenseSerializer if self.action == "license" else PurchaseSerializer

    def get_ready_purchase(self):
        purchase = self.get_object()
        ensure_copy_ready(purchase)
        return purchase

    @action(detail=True, methods=["post"])
    def license(self, request, book=None):
        """Enregistre l'appareil et émet ou renouvelle sa licence hors ligne."""
        purchase = self.get_ready_purchase()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        license_ = issue_license(purchase, **serializer.validated_data)
        return Response(self.get_serializer(license_).data)

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    @action(detail=True)
    def file(self, request, book=None):
        """Renvoie la copie chiffrée du livre, illisible sans la clé de la licence."""
        purchase = self.get_ready_purchase()
        response = FileResponse(
            purchase.encrypted_copy.open("rb"), content_type="application/octet-stream"
        )
        # Exemplaire nominatif : aucun intermédiaire (proxy, cache partagé) ne doit le garder.
        response["Cache-Control"] = "private, no-store"
        return response
