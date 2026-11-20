"""Tests des comptes : inscription, connexion, renouvellement, déconnexion, profil."""

import pytest

from apps.accounts.models import User

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db

REGISTRATION = {
    "email": "Moussa@Example.com",
    "first_name": "Moussa",
    "last_name": "Ouédraogo",
    "password": PASSWORD,
}


def login(api_client, user, password=PASSWORD):
    return api_client.post("/api/auth/login/", {"email": user.email, "password": password})


# --- Inscription --------------------------------------------------------------


def test_register_creates_client_account(api_client):
    response = api_client.post("/api/auth/register/", REGISTRATION)

    assert response.status_code == 201
    assert "password" not in response.data
    created = User.objects.get(email="moussa@example.com")
    assert created.password.startswith("argon2")
    assert not created.is_staff


def test_register_ignores_is_staff(api_client):
    api_client.post("/api/auth/register/", {**REGISTRATION, "is_staff": True})

    assert not User.objects.get(email="moussa@example.com").is_staff


def test_register_rejects_existing_email_whatever_the_case(api_client, user):
    response = api_client.post("/api/auth/register/", {**REGISTRATION, "email": user.email.upper()})

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert "email" in response.data["errors"]


def test_register_rejects_weak_password(api_client):
    response = api_client.post("/api/auth/register/", {**REGISTRATION, "password": "12345678"})

    assert response.status_code == 400
    assert "password" in response.data["errors"]


# --- Connexion ----------------------------------------------------------------


def test_login_returns_access_token_and_sets_refresh_cookie(api_client, user):
    response = login(api_client, user)

    assert response.status_code == 200
    assert set(response.data) == {"access"}
    cookie = response.cookies["refresh_token"]
    assert cookie["httponly"] and cookie["secure"]
    assert cookie["samesite"] == "Strict"
    assert cookie["path"] == "/api/auth/"


def test_login_is_case_insensitive_on_email(api_client, user):
    response = api_client.post(
        "/api/auth/login/", {"email": user.email.upper(), "password": PASSWORD}
    )

    assert response.status_code == 200


def test_login_rejects_wrong_password(api_client, user):
    response = login(api_client, user, password="mauvais-mot-de-passe")

    assert response.status_code == 401
    assert set(response.data) == {"code", "message"}
    assert "refresh_token" not in response.cookies


def test_login_is_throttled(api_client, user):
    statuses = [login(api_client, user, password="faux").status_code for _ in range(11)]

    assert statuses == [401] * 10 + [429]


# --- Profil -------------------------------------------------------------------


def test_me_requires_authentication(api_client):
    response = api_client.get("/api/auth/me/")

    assert response.status_code == 401
    assert response.data["code"] == "not_authenticated"


def test_me_returns_profile(api_client, user):
    access = login(api_client, user).data["access"]

    response = api_client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {access}")

    assert response.status_code == 200
    assert response.data == {
        "id": str(user.id),
        "email": "awa@example.com",
        "first_name": "Awa",
        "last_name": "Traoré",
        "is_staff": False,
    }


# --- Renouvellement et déconnexion --------------------------------------------


def test_refresh_rotates_the_cookie(api_client, user):
    old_refresh = login(api_client, user).cookies["refresh_token"].value

    response = api_client.post("/api/auth/refresh/")

    assert response.status_code == 200
    assert set(response.data) == {"access"}
    assert response.cookies["refresh_token"].value != old_refresh


def test_interrupted_refresh_does_not_log_the_user_out(api_client, user):
    """Requête envoyée mais nouveau cookie jamais reçu : l'ancien jeton sert encore."""
    old_refresh = login(api_client, user).cookies["refresh_token"].value
    api_client.post("/api/auth/refresh/")

    api_client.cookies["refresh_token"] = old_refresh
    assert api_client.post("/api/auth/refresh/").status_code == 200


def test_refresh_without_cookie_is_rejected(api_client):
    response = api_client.post("/api/auth/refresh/")

    assert response.status_code == 401
    assert response.data["code"] == "token_not_valid"


def test_refresh_ignores_token_sent_in_body(api_client, user):
    refresh = login(api_client, user).cookies["refresh_token"].value
    api_client.cookies.clear()

    response = api_client.post("/api/auth/refresh/", {"refresh": refresh})

    assert response.status_code == 401


def test_logout_revokes_token_and_clears_cookie(api_client, user):
    refresh = login(api_client, user).cookies["refresh_token"].value

    response = api_client.post("/api/auth/logout/")

    assert response.status_code == 204
    assert response.cookies["refresh_token"].value == ""

    api_client.cookies["refresh_token"] = refresh
    assert api_client.post("/api/auth/refresh/").status_code == 401


def test_logout_without_cookie_succeeds(api_client):
    assert api_client.post("/api/auth/logout/").status_code == 204
