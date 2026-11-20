"""Catalogue : catégories et livres."""

import uuid
from pathlib import PurePath

from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVector, SearchVectorField
from django.core.files.storage import storages
from django.db import models
from django.db.models import Avg, Count
from django.db.models.functions import Round
from django.utils import timezone
from django.utils.text import slugify

# Configuration de recherche créée par la migration 0001 : français, sans tenir compte des accents.
SEARCH_CONFIG = "french_unaccent"


def public_storage():
    """Stockage des couvertures, lisible par tous."""
    return storages["public"]


def random_path(folder, filename):
    """Régénère le nom du fichier téléversé : seul son extension est conservée."""
    return f"{folder}/{uuid.uuid4().hex}{PurePath(filename).suffix.lower()}"


def cover_path(instance, filename):
    return random_path("covers", filename)


def book_path(instance, filename):
    return random_path("books", filename)


class SluggedModel(models.Model):
    """Attribue à la création un slug unique, dérivé du champ `slug_source`."""

    slug = models.SlugField(max_length=255, unique=True, editable=False)

    slug_source: str

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._unique_slug()
        super().save(*args, **kwargs)

    def _unique_slug(self):
        # Un nom fait seulement de symboles ou d'écritures non latines donnerait un slug vide.
        base = slugify(getattr(self, self.slug_source))[:240] or self._meta.model_name
        taken = set(type(self).objects.filter(slug__startswith=base).values_list("slug", flat=True))
        slug, suffix = base, 2
        while slug in taken:
            slug, suffix = f"{base}-{suffix}", suffix + 1
        return slug


class Category(SluggedModel):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    position = models.PositiveSmallIntegerField(default=0)

    slug_source = "name"

    class Meta:
        ordering = ["position", "name"]

    def __str__(self):
        return self.name


class BookQuerySet(models.QuerySet):
    def with_ratings(self):
        """Ajoute à chaque livre sa note moyenne (une décimale) et son nombre de notes."""
        return self.annotate(
            rating_average=Round(Avg("ratings__stars"), precision=1),
            rating_count=Count("ratings"),
            # Un regroupement fait perdre le tri par défaut : on le rétablit pour la pagination.
        ).order_by(*self.model._meta.ordering)


class Book(SluggedModel):
    class Format(models.TextChoices):
        PDF = "pdf", "PDF"
        EPUB = "epub", "EPUB"

    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="books")
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255)
    description = models.TextField()
    cover = models.ImageField(upload_to=cover_path, storage=public_storage)
    file = models.FileField(upload_to=book_path)
    format = models.CharField(max_length=4, choices=Format)
    # Prix en francs CFA. Un prix vide signifie que le livre est gratuit.
    price = models.PositiveIntegerField(null=True, blank=True)
    is_published = models.BooleanField(default=False)
    # Colonne calculée par PostgreSQL : le titre pèse plus que l'auteur, puis la description.
    search_vector = models.GeneratedField(
        expression=(
            SearchVector("title", weight="A", config=SEARCH_CONFIG)
            + SearchVector("author", weight="B", config=SEARCH_CONFIG)
            + SearchVector("description", weight="C", config=SEARCH_CONFIG)
        ),
        output_field=SearchVectorField(),
        db_persist=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Date de la première publication : c'est elle qui annonce le livre aux clients.
    published_at = models.DateTimeField(null=True, blank=True, editable=False)

    objects = BookQuerySet.as_manager()

    slug_source = "title"

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [GinIndex(fields=["search_vector"], name="book_search_gin")]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__isnull=True) | models.Q(price__gt=0),
                name="book_free_or_positive_price",
            )
        ]

    def __str__(self):
        return self.title

    @property
    def is_free(self):
        return self.price is None

    def save(self, *args, **kwargs):
        # Un livre retiré puis republié garde sa date : il n'est annoncé qu'une fois.
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Supprime le livre, puis ses fichiers une fois la suppression acceptée par la base."""
        result = super().delete(*args, **kwargs)
        self.cover.delete(save=False)
        self.file.delete(save=False)
        return result


class Rating(models.Model):
    """Note de 1 à 5 étoiles donnée par un client à un livre ; une seule par client et par livre."""

    MIN_STARS, MAX_STARS = 1, 5

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ratings"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="ratings")
    stars = models.PositiveSmallIntegerField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="one_rating_per_user_and_book"),
            models.CheckConstraint(
                condition=models.Q(stars__range=(1, 5)), name="rating_between_1_and_5_stars"
            ),
        ]

    def __str__(self):
        return f"{self.book} : {self.stars}/{self.MAX_STARS}"
