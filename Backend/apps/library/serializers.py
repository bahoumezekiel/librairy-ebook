"""Sérialiseurs de la bibliothèque personnelle."""

from base64 import b64encode

from rest_framework import serializers

from apps.catalog.serializers import BookSerializer

from .models import DeviceLicense, Purchase


class PurchaseSerializer(serializers.ModelSerializer):
    """Livre acheté. `is_ready` indique si la copie chiffrée peut être téléchargée."""

    book = BookSerializer(read_only=True)
    is_ready = serializers.BooleanField(read_only=True)

    class Meta:
        model = Purchase
        fields = ["book", "purchased_at", "is_ready"]


class DeviceLicenseSerializer(serializers.ModelSerializer):
    """Licence d'un appareil, avec la clé de déchiffrement du livre encodée en base64."""

    key = serializers.SerializerMethodField()

    class Meta:
        model = DeviceLicense
        fields = ["device_id", "name", "expires_at", "key"]
        read_only_fields = ["expires_at"]

    def get_key(self, license_) -> str:
        return b64encode(license_.purchase.encryption_key).decode()
