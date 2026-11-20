"""Tâche Celery : préparation de la copie personnelle d'un livre acheté."""

from celery import shared_task
from django.core.files.base import ContentFile
from django.db import transaction

from apps.catalog.models import Book

from .models import Purchase
from .protection import encrypt, watermark_pdf


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def prepare_purchase_copy(purchase_pk):
    """
    Crée la copie filigranée et chiffrée d'un achat, avec sa propre clé.

    Peut être relancée sans risque : elle ne fait rien si la copie existe déjà
    ou si une autre exécution la prépare (ligne verrouillée).
    """
    with transaction.atomic():
        purchase = (
            Purchase.objects.select_for_update(skip_locked=True, of=("self",))
            .select_related("book", "user")
            .filter(pk=purchase_pk, encrypted_copy="")
            .first()
        )
        if purchase is None:
            return

        book, buyer = purchase.book, purchase.user
        with book.file.open("rb") as source:
            content = source.read()
        # Un EPUB n'est pas modifié : son filigrane est affiché par le lecteur.
        if book.format == Book.Format.PDF:
            owner = f"{buyer.first_name} {buyer.last_name} – {buyer.email}"
            content = watermark_pdf(content, f"Exemplaire personnel de {owner}")

        purchase.encryption_key, encrypted = encrypt(content)
        purchase.encrypted_copy.save("copie.bin", ContentFile(encrypted), save=False)
        purchase.save(update_fields=["encryption_key", "encrypted_copy"])
