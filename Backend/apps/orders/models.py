"""Commandes, paiements Genius Pay et notifications reçues."""

import uuid

from django.conf import settings
from django.db import models


class Order(models.Model):
    """Achat d'un livre payant par un client. Le montant est figé à la création."""

    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        PAID = "paid", "Payée"
        FAILED = "failed", "Échouée"
        CANCELLED = "cancelled", "Annulée"
        EXPIRED = "expired", "Expirée"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders"
    )
    book = models.ForeignKey("catalog.Book", on_delete=models.PROTECT, related_name="orders")
    amount = models.PositiveIntegerField()
    status = models.CharField(max_length=9, choices=Status, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.id} ({self.get_status_display()})"


class Payment(models.Model):
    """Transaction Genius Pay rattachée à une commande."""

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="payment")
    reference = models.CharField(max_length=100, unique=True)
    # Statut tel que renvoyé par Genius Pay, conservé pour le suivi.
    status = models.CharField(max_length=50)
    raw_response = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.reference


class WebhookEvent(models.Model):
    """Notification reçue de Genius Pay ; `event_id` unique empêche tout double enregistrement."""

    event_id = models.CharField(max_length=64, unique=True)
    type = models.CharField(max_length=50, blank=True)
    payload = models.JSONField()
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.type} {self.event_id[:12]}"
