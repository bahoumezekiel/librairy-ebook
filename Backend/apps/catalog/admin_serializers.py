"""Sérialiseurs du back-office : gestion des catégories et des livres."""

import logging
from pathlib import PurePath

from rest_framework import serializers

from .models import Book, Category
from .validators import MIN_PRICE, check_book_file, check_cover

logger = logging.getLogger(__name__)


class AdminCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["name", "slug", "description", "position"]


class AdminBookSerializer(serializers.ModelSerializer):
    """
    Livre vu par l'administrateur.

    Le fichier est en écriture seule et son format est déduit de son contenu.
    Un prix vide rend le livre gratuit.
    """

    category = serializers.SlugRelatedField(slug_field="slug", queryset=Category.objects.all())
    is_free = serializers.BooleanField(read_only=True)
    # Valeurs par défaut : celles d'un livre tout juste créé, qui n'a encore aucune note.
    rating_average = serializers.FloatField(read_only=True, default=None)
    rating_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Book
        fields = [
            "slug",
            "title",
            "author",
            "description",
            "cover",
            "file",
            "category",
            "format",
            "is_free",
            "price",
            "is_published",
            "rating_average",
            "rating_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["format"]
        # `max_length: None` : le nom d'origine du fichier n'est pas limité, car il est
        # remplacé à l'enregistrement par un nom court et aléatoire (voir `random_path`).
        extra_kwargs = {
            "cover": {"max_length": None},
            "file": {"write_only": True, "max_length": None},
            "price": {"min_value": MIN_PRICE},
        }

    def validate_cover(self, cover):
        return check_cover(cover)

    def validate_file(self, file):
        return check_book_file(file)

    def validate(self, attrs):
        if "file" in attrs:
            attrs["format"] = PurePath(attrs["file"].name).suffix[1:]
        return attrs

    def update(self, instance, validated_data):
        """Enregistre les modifications, puis retire du stockage les fichiers remplacés."""
        replaced = [
            (field.storage, field.name)
            for field in (instance.cover, instance.file)
            if field.field.name in validated_data
        ]
        instance = super().update(instance, validated_data)
        for storage, name in replaced:
            try:
                storage.delete(name)
            except Exception:  # noqa: BLE001 - stockage indisponible, quelle que soit l'erreur
                # La modification est déjà enregistrée : elle ne doit pas échouer pour
                # un ancien fichier resté en place. Le ménage se fera plus tard.
                logger.warning("Ancien fichier « %s » non supprimé du stockage", name)
        return instance
