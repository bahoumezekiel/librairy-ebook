"""Vues du catalogue : catégories, livres publiés, téléchargement, notes et nouveautés."""

from datetime import timedelta

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.library.models import Purchase

from .filters import BookFilter
from .models import Book, Category, Rating
from .serializers import (
    CatalogBookSerializer,
    CategorySerializer,
    NotificationSerializer,
    RatingSerializer,
)

# Un livre reste annoncé comme nouveauté pendant cette durée après sa publication.
NOTIFICATION_PERIOD = timedelta(days=30)
MAX_NOTIFICATIONS = 20


class CategoryListView(generics.ListAPIView):
    """Liste complète des catégories, dans l'ordre choisi par l'administrateur."""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None


class BookViewSet(viewsets.ReadOnlyModelViewSet):
    """Catalogue des livres publiés."""

    queryset = Book.objects.with_ratings().filter(is_published=True).select_related("category")
    serializer_class = CatalogBookSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend]
    filterset_class = BookFilter

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    @action(detail=True)
    def download(self, request, slug=None):
        """Transmet le fichier du livre. Réservé aux livres gratuits.

        L'API relaie le fichier au lieu de renvoyer le client vers le stockage objet :
        celui-ci n'est joignable que depuis le réseau privé de la composition, et il n'a
        pas à en sortir. C'est aussi ainsi qu'un livre acheté est remis (apps.library).
        """
        book = self.get_object()
        if not book.is_free:
            raise PermissionDenied("Ce livre est payant : il ne peut pas être téléchargé.")
        return FileResponse(
            book.file.open("rb"),
            as_attachment=True,
            filename=f"{book.slug}.{book.format}",
        )

    @action(
        detail=True,
        methods=["get", "put", "delete"],
        permission_classes=[IsAuthenticated],
        serializer_class=RatingSerializer,
    )
    def rating(self, request, slug=None):
        """
        Note du client connecté pour ce livre : la lire, la donner ou la modifier, la retirer.

        Un livre payant ne peut être noté que par un client qui l'a acheté.
        """
        book = self.get_object()
        own_rating = Rating.objects.filter(user=request.user, book=book)

        if request.method == "GET":
            return Response(self.get_serializer(get_object_or_404(own_rating)).data)
        if request.method == "DELETE":
            own_rating.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        if not book.is_free and not Purchase.objects.filter(user=request.user, book=book).exists():
            raise PermissionDenied("Achetez ce livre pour pouvoir le noter.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Rating.objects.update_or_create(
            user=request.user, book=book, defaults=serializer.validated_data
        )
        return Response(serializer.data)


class NotificationListView(generics.ListAPIView):
    """Livres publiés récemment, du plus récent au plus ancien, avec leur état lu ou non lu."""

    serializer_class = NotificationSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            Book.objects.filter(
                is_published=True, published_at__gte=timezone.now() - NOTIFICATION_PERIOD
            )
            .select_related("category")
            .order_by("-published_at")[:MAX_NOTIFICATIONS]
        )


class NotificationReadView(APIView):
    """Marque toutes les nouveautés comme lues pour le client connecté."""

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        request.user.notifications_read_at = timezone.now()
        request.user.save(update_fields=["notifications_read_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
