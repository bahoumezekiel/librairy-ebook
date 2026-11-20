"""Bibliothèque personnelle : achats, copies chiffrées et licences d'appareil."""

from django.conf import settings
from django.db import models

from apps.catalog.models import random_path


def copy_path(instance, filename):
    return random_path("copies", filename)


class Purchase(models.Model):
    """Droit d'accès d'un client à un livre, créé uniquement par une commande payée."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="purchases"
    )
    book = models.ForeignKey("catalog.Book", on_delete=models.PROTECT, related_name="purchases")
    order = models.OneToOneField("orders.Order", on_delete=models.PROTECT, related_name="purchase")
    purchased_at = models.DateTimeField(auto_now_add=True)
    # Copie personnelle (filigranée pour un PDF) chiffrée en AES-256-GCM avec `encryption_key`.
    # Les deux champs restent vides tant que la copie n'a pas été préparée.
    encrypted_copy = models.FileField(upload_to=copy_path, blank=True)
    encryption_key = models.BinaryField(max_length=32, blank=True)

    class Meta:
        ordering = ["-purchased_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="one_purchase_per_user_and_book")
        ]

    def __str__(self):
        return f"{self.user} – {self.book}"

    @property
    def is_ready(self):
        """Vrai dès que la copie chiffrée peut être téléchargée."""
        return bool(self.encrypted_copy)


class DeviceLicense(models.Model):
    """Autorisation de lire un achat hors ligne sur un appareil, pour une durée limitée."""

    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="licenses")
    # Identifiant généré par l'application sur l'appareil.
    device_id = models.UUIDField()
    name = models.CharField(max_length=100)
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    last_used_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["purchase", "device_id"], name="one_license_per_purchase_and_device"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.purchase})"
