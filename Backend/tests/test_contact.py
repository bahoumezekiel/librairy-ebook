"""Tests du formulaire de contact et de la newsletter."""

import pytest

from apps.contact.models import ContactMessage, NewsletterSubscriber

pytestmark = pytest.mark.django_db

MESSAGE = {
    "name": "Awa Traoré",
    "email": "awa@example.com",
    "subject": "Question sur un livre",
    "message": "Le livre sur Django existe-t-il en EPUB ?",
}


def test_visitor_sends_a_message(api_client):
    response = api_client.post("/api/contact/", MESSAGE)

    assert response.status_code == 201
    assert ContactMessage.objects.get().subject == "Question sur un livre"


@pytest.mark.parametrize("field", ["name", "email", "subject", "message"])
def test_every_field_is_required(api_client, field):
    response = api_client.post("/api/contact/", {**MESSAGE, field: ""})

    assert response.status_code == 400
    assert list(response.data["errors"]) == [field]
    assert not ContactMessage.objects.exists()


def test_message_length_is_limited(api_client):
    response = api_client.post("/api/contact/", {**MESSAGE, "message": "x" * 5001})

    assert response.status_code == 400
    assert "message" in response.data["errors"]


def test_sending_is_throttled(api_client):
    statuses = [api_client.post("/api/contact/", MESSAGE).status_code for _ in range(6)]

    assert statuses == [201] * 5 + [429]


def test_messages_are_reserved_to_the_administrator(api_client, user_client):
    assert api_client.get("/api/admin/messages/").status_code == 401
    assert user_client.get("/api/admin/messages/").status_code == 403


def test_administrator_reads_then_deletes_a_message(staff_client, api_client):
    api_client.post("/api/contact/", MESSAGE)

    listed = staff_client.get("/api/admin/messages/").data["results"]
    assert [item["email"] for item in listed] == ["awa@example.com"]

    assert staff_client.delete(f"/api/admin/messages/{listed[0]['id']}/").status_code == 204
    assert not ContactMessage.objects.exists()


# --- Newsletter ----------------------------------------------------------------


def test_visitor_subscribes_to_the_newsletter(api_client):
    response = api_client.post("/api/newsletter/", {"email": "Lecteur@Example.com"})

    assert response.status_code == 201
    assert response.data == {"email": "lecteur@example.com"}
    assert NewsletterSubscriber.objects.get().email == "lecteur@example.com"


def test_subscribing_twice_keeps_one_address_and_reveals_nothing(api_client):
    first = api_client.post("/api/newsletter/", {"email": "lecteur@example.com"})
    second = api_client.post("/api/newsletter/", {"email": "LECTEUR@example.com"})

    assert first.status_code == second.status_code == 201
    assert NewsletterSubscriber.objects.count() == 1


@pytest.mark.parametrize("email", ["", "pas-une-adresse"])
def test_invalid_address_is_rejected(api_client, email):
    response = api_client.post("/api/newsletter/", {"email": email})

    assert response.status_code == 400
    assert "email" in response.data["errors"]


def test_subscribers_are_reserved_to_the_administrator(api_client, user_client):
    assert api_client.get("/api/admin/subscribers/").status_code == 401
    assert user_client.get("/api/admin/subscribers/").status_code == 403


def test_administrator_lists_then_removes_a_subscriber(staff_client, api_client):
    api_client.post("/api/newsletter/", {"email": "lecteur@example.com"})

    listed = staff_client.get("/api/admin/subscribers/").data["results"]
    assert [item["email"] for item in listed] == ["lecteur@example.com"]

    assert staff_client.delete(f"/api/admin/subscribers/{listed[0]['id']}/").status_code == 204
    assert not NewsletterSubscriber.objects.exists()


def test_contact_and_newsletter_have_separate_quotas(api_client):
    for _ in range(5):
        api_client.post("/api/contact/", MESSAGE)

    assert api_client.post("/api/contact/", MESSAGE).status_code == 429
    assert api_client.post("/api/newsletter/", {"email": "lecteur@example.com"}).status_code == 201
