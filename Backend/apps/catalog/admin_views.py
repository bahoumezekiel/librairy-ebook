"""Vues du back-office : gestion des catégories et des livres, réservée à l'administrateur."""

from django.db.models import ProtectedError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser

from config.exceptions import Conflict

from .admin_serializers import AdminBookSerializer, AdminCategorySerializer
from .filters import BookFilter
from .models import Book, Category


class ProtectedDestroyMixin:
    """Répond 409 avec `protected_message` quand la base refuse une suppression."""

    protected_message: str

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise Conflict(self.protected_message) from exc


class AdminCategoryViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    """Ajout, modification et suppression des catégories."""

    queryset = Category.objects.all()
    serializer_class = AdminCategorySerializer
    permission_classes = [IsAdminUser]
    lookup_field = "slug"
    pagination_class = None
    protected_message = (
        "Cette catégorie contient des livres : déplacez-les ou supprimez-les d'abord."
    )


class AdminBookViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    """Ajout, modification, publication et suppression des livres, publiés ou non."""

    queryset = Book.objects.with_ratings().select_related("category")
    serializer_class = AdminBookSerializer
    permission_classes = [IsAdminUser]
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend]
    filterset_class = BookFilter
    protected_message = (
        "Ce livre a déjà été commandé : retirez-le du catalogue au lieu de le supprimer."
    )
