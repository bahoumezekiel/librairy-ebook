"""Tests des fondations : format d'erreur, contrôle de santé, documentation, base de données."""

import pytest
from django.db import connection
from rest_framework.exceptions import APIException, NotAuthenticated, ValidationError

from config.exceptions import api_exception_handler


def test_unknown_route_returns_json_error(client):
    response = client.get("/route-inconnue/")

    assert response.status_code == 404
    assert response.json() == {"code": "not_found", "message": "Ressource introuvable."}


def test_api_error_has_code_and_message():
    response = api_exception_handler(NotAuthenticated(), {})

    assert response.status_code == 401
    assert set(response.data) == {"code", "message"}
    assert response.data["code"] == "not_authenticated"


def test_validation_error_lists_field_errors():
    response = api_exception_handler(ValidationError({"email": ["Ce champ est obligatoire."]}), {})

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert response.data["errors"] == {"email": ["Ce champ est obligatoire."]}


def test_error_carrying_a_list_keeps_the_api_format():
    """Une exception portant une liste ne doit pas faire échouer la mise en forme."""
    response = api_exception_handler(APIException(["Première cause", "Seconde cause"]), {})

    assert set(response.data) == {"code", "message"}
    assert response.data["code"] == "error"


@pytest.mark.parametrize("url", ["/api/schema/", "/api/docs/"])
def test_documentation_is_served(client, url):
    assert client.get(url).status_code == 200


@pytest.mark.django_db
def test_health_check_reports_the_services(client):
    """Interrogé par Docker et Nginx : répond sans authentification."""
    response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_database_is_postgresql():
    assert connection.vendor == "postgresql"
