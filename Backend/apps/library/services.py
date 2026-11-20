"""Règles métier de la bibliothèque : disponibilité de la copie et licences d'appareil."""

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from config.exceptions import Conflict

from .models import Purchase
from .tasks import prepare_purchase_copy


def ensure_copy_ready(purchase):
    """Refuse l'accès tant que la copie chiffrée n'existe pas, et relance sa préparation."""
    if not purchase.is_ready:
        prepare_purchase_copy.delay(purchase.pk)
        raise Conflict(
            "Votre exemplaire est en cours de préparation. Réessayez dans un instant.",
            code="copy_not_ready",
        )


def issue_license(purchase, device_id, name):
    """
    Émet ou renouvelle la licence hors ligne d'un appareil pour cet achat.

    Seules les licences encore valides occupent une place : une licence expirée
    libère la sienne.
    """
    now = timezone.now()
    with transaction.atomic():
        # Verrou sur l'achat : deux appareils ne peuvent pas prendre ensemble la dernière place.
        Purchase.objects.select_for_update().get(pk=purchase.pk)
        other_devices = purchase.licenses.filter(expires_at__gt=now).exclude(device_id=device_id)
        if other_devices.count() >= settings.MAX_DEVICES_PER_PURCHASE:
            raise Conflict(
                f"Ce livre est déjà utilisé sur {settings.MAX_DEVICES_PER_PURCHASE} appareils.",
                code="device_limit_reached",
            )
        license_, _ = purchase.licenses.update_or_create(
            device_id=device_id,
            defaults={
                "name": name,
                "expires_at": now + timedelta(days=settings.OFFLINE_LICENSE_DAYS),
            },
        )
    return license_
