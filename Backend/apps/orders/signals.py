"""
Réception des notifications Genius Pay.

La vue du SDK (/geniuspay/webhook/) a déjà vérifié la signature HMAC-SHA256 et
l'horodatage quand ce signal est émis. Ici, on enregistre l'événement et on
confie son traitement à Celery.
"""

import hashlib
import json

from django.dispatch import receiver
from geniuspay.signals import webhook_received

from .models import WebhookEvent
from .tasks import process_webhook_event


@receiver(webhook_received)
def record_webhook_event(sender, raw_event, payload, **kwargs):
    # Genius Pay numérote chaque notification (`id`, vérifié en sandbox) : une notification
    # renvoyée retrouve le même événement. À défaut, l'empreinte du contenu sert d'identifiant.
    event_id = (
        str(raw_event.get("id") or "")
        or hashlib.sha256(json.dumps(raw_event, sort_keys=True).encode()).hexdigest()
    )
    event, _ = WebhookEvent.objects.get_or_create(
        event_id=event_id,
        defaults={"type": str(raw_event.get("event", ""))[:50], "payload": raw_event},
    )
    if event.processed_at is None:
        process_webhook_event.delay(event.pk, payload.get("reference"))
