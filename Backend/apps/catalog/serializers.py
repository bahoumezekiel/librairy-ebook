"""Sérialiseurs publics du catalogue."""

from rest_framework import serializers

from .models import Book, Category, Rating


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["name", "slug", "description"]


class BookSerializer(serializers.ModelSerializer):
    """Fiche d'un livre. Le fichier du livre n'est jamais exposé ici."""

    category = CategorySerializer(read_only=True)
    is_free = serializers.BooleanField(read_only=True)

    class Meta:
        model = Book
        fields = [
            "slug",
            "title",
            "author",
            "description",
            "cover",
            "category",
            "format",
            "is_free",
            "price",
            "published_at",
        ]


class CatalogBookSerializer(BookSerializer):
    """Fiche d'un livre du catalogue, avec sa note moyenne (`null` tant qu'il n'a aucune note)."""

    rating_average = serializers.FloatField(read_only=True)
    rating_count = serializers.IntegerField(read_only=True)

    class Meta(BookSerializer.Meta):
        fields = [*BookSerializer.Meta.fields, "rating_average", "rating_count"]


class RatingSerializer(serializers.ModelSerializer):
    stars = serializers.IntegerField(min_value=Rating.MIN_STARS, max_value=Rating.MAX_STARS)

    class Meta:
        model = Rating
        fields = ["stars"]


class NotificationSerializer(serializers.Serializer):
    """Annonce d'un nouveau livre ; `is_read` vaut vrai si le client l'a déjà vue."""

    book = BookSerializer(source="*")
    published_at = serializers.DateTimeField()
    is_read = serializers.SerializerMethodField()

    def get_is_read(self, book) -> bool:
        return book.published_at <= self.context["request"].user.notifications_read_at
