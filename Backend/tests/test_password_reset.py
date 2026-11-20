"""Tests de la réinitialisation du mot de passe : demande du lien, puis changement."""

import re
from datetime import datetime, timedelta

import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db

NOUVEAU = "Nouveau-Motdepasse-2026"
DEMANDE = "/api/auth/password-reset/"
CONFIRMATION = "/api/auth/password-reset/confirm/"


def lien_recu():
    """Identifiant et jeton extraits du dernier message envoyé."""
    trouve = re.search(r"/mot-de-passe/([^/]+)/(\S+)", mail.outbox[-1].body)
    return {"uid": trouve[1], "token": trouve[2]}


def demander(api_client, email):
    return api_client.post(DEMANDE, {"email": email})


def login(api_client, email, password):
    return api_client.post("/api/auth/login/", {"email": email, "password": password})


# --- Demande du lien ----------------------------------------------------------


def test_a_request_sends_a_link_to_the_account_holder(api_client, user):
    response = demander(api_client, user.email)

    assert response.status_code == 204
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [user.email]
    assert "/mot-de-passe/" in mail.outbox[0].body


def test_an_unknown_address_gives_the_same_answer_and_no_mail(api_client, db):
    response = demander(api_client, "personne@example.com")

    # Réponse identique à celle d'un compte existant : la route ne doit pas
    # permettre de deviner quelles adresses sont inscrites.
    assert response.status_code == 204
    assert mail.outbox == []


def test_the_address_is_recognised_whatever_the_case(api_client, user):
    assert demander(api_client, user.email.upper()).status_code == 204
    assert len(mail.outbox) == 1


def test_a_malformed_address_is_refused(api_client, db):
    response = demander(api_client, "pas-une-adresse")

    assert response.status_code == 400
    assert "email" in response.data["errors"]
    assert mail.outbox == []


# --- Changement du mot de passe -----------------------------------------------


def test_the_link_allows_a_new_password(api_client, user):
    demander(api_client, user.email)

    response = api_client.post(CONFIRMATION, {**lien_recu(), "password": NOUVEAU})

    assert response.status_code == 204
    assert login(api_client, user.email, NOUVEAU).status_code == 200
    assert login(api_client, user.email, PASSWORD).status_code == 401


def test_a_link_cannot_serve_twice(api_client, user):
    demander(api_client, user.email)
    lien = lien_recu()
    api_client.post(CONFIRMATION, {**lien, "password": NOUVEAU})

    response = api_client.post(CONFIRMATION, {**lien, "password": "Encore-Un-Autre-2026"})

    assert response.status_code == 400
    assert response.data["code"] == "invalid_reset_link"
    # Le premier mot de passe choisi reste le bon.
    assert login(api_client, user.email, NOUVEAU).status_code == 200


def test_a_tampered_token_is_refused(api_client, user):
    demander(api_client, user.email)
    lien = lien_recu()

    response = api_client.post(
        CONFIRMATION, {**lien, "token": lien["token"][:-1] + "x", "password": NOUVEAU}
    )

    assert response.status_code == 400
    assert response.data["code"] == "invalid_reset_link"


def test_an_unusable_identifier_is_refused(api_client, user):
    demander(api_client, user.email)

    response = api_client.post(
        CONFIRMATION, {**lien_recu(), "uid": "pas-du-base64", "password": NOUVEAU}
    )

    assert response.status_code == 400
    assert response.data["code"] == "invalid_reset_link"


def test_a_link_older_than_an_hour_is_refused(api_client, user, monkeypatch):
    demander(api_client, user.email)
    lien = lien_recu()
    # `_now()` de Django renvoie une date sans fuseau : la remplacer par une date
    # avec fuseau ferait échouer sa soustraction interne.
    plus_tard = datetime.now() + timedelta(hours=2)
    monkeypatch.setattr(default_token_generator, "_now", lambda: plus_tard)

    response = api_client.post(CONFIRMATION, {**lien, "password": NOUVEAU})

    assert response.status_code == 400
    assert response.data["code"] == "invalid_reset_link"


def test_a_weak_password_is_refused_and_changes_nothing(api_client, user):
    demander(api_client, user.email)

    response = api_client.post(CONFIRMATION, {**lien_recu(), "password": "12345678"})

    assert response.status_code == 400
    assert "password" in response.data["errors"]
    assert login(api_client, user.email, PASSWORD).status_code == 200


def test_the_link_is_checked_before_the_password(api_client, user):
    demander(api_client, user.email)

    response = api_client.post(
        CONFIRMATION, {**lien_recu(), "uid": "pas-du-base64", "password": "12345678"}
    )

    # Sur un lien périmé, reprocher la qualité du mot de passe n'aurait aucun sens.
    assert response.data["code"] == "invalid_reset_link"


def test_a_password_beyond_the_allowed_length_is_refused(api_client, user):
    demander(api_client, user.email)

    response = api_client.post(CONFIRMATION, {**lien_recu(), "password": "a" * 129})

    assert response.status_code == 400
    assert "password" in response.data["errors"]


# --- Limitation ---------------------------------------------------------------


def test_requests_are_limited_to_five_per_hour(api_client, user):
    for _ in range(5):
        assert demander(api_client, user.email).status_code == 204

    # Chaque appel envoie un e-mail à un tiers : la route ne doit pas servir à le harceler.
    assert demander(api_client, user.email).status_code == 429
    assert len(mail.outbox) == 5
