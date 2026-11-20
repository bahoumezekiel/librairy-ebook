"""Tâche Celery : envoi du lien de réinitialisation du mot de passe."""

from celery import shared_task
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMessage
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .models import User

SUJET = "FasoLib – réinitialisation de votre mot de passe"

MESSAGE = """Bonjour {prenom},

Vous avez demandé à changer le mot de passe de votre compte FasoLib.
Ouvrez le lien ci-dessous pour en choisir un nouveau :

{lien}

Ce lien est valable une heure et ne sert qu'une fois.

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message :
votre mot de passe actuel reste valable.

L'équipe FasoLib
"""


def reset_link(user):
    """Lien de réinitialisation : l'identifiant encodé, puis le jeton signé."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    return f"{settings.FRONTEND_URL}/mot-de-passe/{uid}/{default_token_generator.make_token(user)}"


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def send_password_reset_email(user_pk):
    """
    Envoie le lien au titulaire du compte.

    Peut être relancée sans risque : un compte supprimé entre-temps est simplement
    ignoré, et un nouveau jeton est calculé à chaque tentative.
    """
    user = User.objects.filter(pk=user_pk).first()
    if user is None:
        return
    EmailMessage(
        subject=SUJET,
        body=MESSAGE.format(prenom=user.first_name, lien=reset_link(user)),
        to=[user.email],
    ).send()
