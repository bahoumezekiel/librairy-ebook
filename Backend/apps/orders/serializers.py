"""Sérialiseurs des commandes, côté client et côté back-office."""

from rest_framework import serializers

from apps.catalog.models import Book

from .models import Order
from .stats import DEFAULT_PERIOD, PERIOD_CHOICES


class OrderSerializer(serializers.ModelSerializer):
    """Commande d'un client. Seul le livre est fourni ; le montant est lu en base."""

    book = serializers.SlugRelatedField(
        slug_field="slug", queryset=Book.objects.filter(is_published=True)
    )

    class Meta:
        model = Order
        fields = ["id", "book", "amount", "status", "created_at", "paid_at"]
        read_only_fields = ["amount", "status", "paid_at"]

    def validate_book(self, book):
        if book.is_free:
            raise serializers.ValidationError("Ce livre est gratuit : il n'y a rien à payer.")
        return book


class CreatedOrderSerializer(OrderSerializer):
    """Commande tout juste créée, avec l'URL de la page de paiement."""

    payment_url = serializers.URLField(read_only=True)

    class Meta(OrderSerializer.Meta):
        fields = [*OrderSerializer.Meta.fields, "payment_url"]


class AdminOrderSerializer(serializers.ModelSerializer):
    """Commande et son paiement, vus par l'administrateur."""

    client = serializers.EmailField(source="user.email", read_only=True)
    book = serializers.CharField(source="book.title", read_only=True)
    payment_reference = serializers.CharField(
        source="payment.reference", read_only=True, allow_null=True
    )
    payment_status = serializers.CharField(source="payment.status", read_only=True, allow_null=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "client",
            "book",
            "amount",
            "status",
            "created_at",
            "paid_at",
            "payment_reference",
            "payment_status",
        ]


class StatsQuerySerializer(serializers.Serializer):
    """Paramètres du tableau de bord : durée de la période analysée, en jours."""

    days = serializers.ChoiceField(choices=PERIOD_CHOICES, default=DEFAULT_PERIOD)
