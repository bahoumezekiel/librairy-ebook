"""Tests du paiement : commandes, notifications Genius Pay, rattrapage, back-office."""

import hashlib
import hmac
import json
import time
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.library.models import Purchase
from apps.orders import gateway
from apps.orders.models import Order, Payment, WebhookEvent
from apps.orders.tasks import sync_pending_payments

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db

WEBHOOK_SECRET = "whsec_test"


@pytest.fixture(autouse=True)
def geniuspay_keys(settings):
    settings.GENIUSPAY = {
        "API_KEY": "pk_sandbox_test",
        "API_SECRET": "sk_sandbox_test",
        "WEBHOOK_SECRET": WEBHOOK_SECRET,
    }


@pytest.fixture
def paid_book(make_book):
    return make_book(title="Livre payant", price=5000)


@pytest.fixture
def order(user_client, paid_book, fake_gateway):
    """Commande en attente du client, créée par l'API."""
    response = user_client.post("/api/orders/", {"book": paid_book.slug})
    return Order.objects.get(pk=response.data["id"])


def send_webhook(api_client, reference, *, status="completed", secret=WEBHOOK_SECRET, **extra):
    """Envoie une notification signée comme le fait Genius Pay."""
    event = {"event": "payment.success", "data": {"reference": reference, "status": status}}
    body = json.dumps(event | extra).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256)
    return api_client.post(
        "/geniuspay/webhook/",
        body,
        content_type="application/json",
        HTTP_X_WEBHOOK_SIGNATURE=signature.hexdigest(),
        HTTP_X_WEBHOOK_TIMESTAMP=timestamp,
    )


def has_access(order):
    return Purchase.objects.filter(user=order.user, book=order.book).exists()


# --- Création d'une commande --------------------------------------------------


def test_order_creation_returns_the_payment_url(user_client, paid_book, fake_gateway):
    response = user_client.post("/api/orders/", {"book": paid_book.slug})

    assert response.status_code == 201
    assert response.data["status"] == "pending"
    assert response.data["payment_url"] == "https://pay.example/MTX-000001"
    assert Payment.objects.get(order_id=response.data["id"]).reference == "MTX-000001"


def test_amount_is_read_from_the_database_not_from_the_client(user_client, paid_book, fake_gateway):
    response = user_client.post("/api/orders/", {"book": paid_book.slug, "amount": 1})

    assert response.data["amount"] == 5000
    assert fake_gateway.payments["MTX-000001"].amount == 5000


def test_order_requires_authentication(api_client, paid_book):
    assert api_client.post("/api/orders/", {"book": paid_book.slug}).status_code == 401


@pytest.mark.parametrize("book_fields", [{"price": None}, {"price": 5000, "is_published": False}])
def test_free_or_unpublished_book_cannot_be_ordered(user_client, make_book, book_fields):
    book = make_book(**book_fields)

    response = user_client.post("/api/orders/", {"book": book.slug})

    assert response.status_code == 400
    assert "book" in response.data["errors"]
    assert not Order.objects.exists()


def test_owned_book_cannot_be_ordered_again(user_client, api_client, order, fake_gateway):
    fake_gateway.settle(order.payment.reference, "completed")
    send_webhook(api_client, order.payment.reference)

    response = user_client.post("/api/orders/", {"book": order.book.slug})

    assert response.status_code == 409
    assert response.data["code"] == "conflict"


def test_a_second_attempt_resumes_the_pending_payment(user_client, order):
    """Recliquer sur « Acheter » renvoie au paiement en cours, au lieu d'en ouvrir un second."""
    response = user_client.post("/api/orders/", {"book": order.book.slug})

    assert response.data["id"] == str(order.id)
    assert response.data["payment_url"] == f"https://pay.example/{order.payment.reference}"
    assert Order.objects.count() == 1


def test_a_pending_payment_lost_by_the_gateway_is_replaced(user_client, order, fake_gateway):
    """Un paiement que le prestataire ne connaît plus ne doit pas bloquer l'achat."""
    fake_gateway.payments.clear()

    response = user_client.post("/api/orders/", {"book": order.book.slug})

    assert response.status_code == 201
    assert response.data["id"] != str(order.id)


def test_a_second_attempt_on_an_already_paid_order_gives_the_book(
    user_client, order, fake_gateway
):
    """La notification s'est perdue : la nouvelle tentative constate le paiement déjà abouti."""
    fake_gateway.settle(order.payment.reference, "completed")

    response = user_client.post("/api/orders/", {"book": order.book.slug})

    assert response.status_code == 409
    assert response.data["code"] == "conflict"
    assert Purchase.objects.filter(book=order.book).exists()


def test_gateway_failure_marks_the_order_failed(user_client, paid_book, fake_gateway):
    fake_gateway.is_down = True

    response = user_client.post("/api/orders/", {"book": paid_book.slug})

    assert response.status_code == 502
    assert response.data["code"] == "payment_unavailable"
    assert Order.objects.get().status == Order.Status.FAILED


# --- Suivi d'une commande -----------------------------------------------------


def test_client_follows_only_their_own_order(user_client, order):
    stranger = User.objects.create_user(
        email="autre@example.com", password=PASSWORD, first_name="Autre", last_name="Client"
    )

    assert user_client.get(f"/api/orders/{order.id}/").data["status"] == "pending"
    user_client.force_authenticate(stranger)
    assert user_client.get(f"/api/orders/{order.id}/").status_code == 404


def age_payment(order, seconds=11):
    """Vieillit la dernière relecture pour sortir de l'intervalle de garde."""
    Payment.objects.filter(order=order).update(
        updated_at=timezone.now() - timedelta(seconds=seconds)
    )


def test_tracking_confirms_a_payment_whose_notification_was_lost(user_client, order, fake_gateway):
    """Une notification peut se perdre : la page de suivi relit le paiement elle-même."""
    fake_gateway.settle(order.payment.reference, "completed")
    age_payment(order)

    response = user_client.get(f"/api/orders/{order.id}/")

    assert response.data["status"] == "paid"
    assert has_access(order)


def test_tracking_reads_the_gateway_once_per_interval(
    user_client, order, fake_gateway, monkeypatch
):
    """La page interroge en boucle : le prestataire ne doit pas l'être à chaque fois."""
    calls = []
    monkeypatch.setattr(
        gateway, "fetch_payment", lambda ref: calls.append(ref) or fake_gateway.fetch_payment(ref)
    )
    age_payment(order)

    for _ in range(5):
        assert user_client.get(f"/api/orders/{order.id}/").status_code == 200

    assert calls == [order.payment.reference]


def test_tracking_stays_available_when_the_gateway_is_down(user_client, order, fake_gateway):
    """Une panne du prestataire laisse la commande en attente, sans erreur pour le client."""
    fake_gateway.is_down = True
    age_payment(order)

    response = user_client.get(f"/api/orders/{order.id}/")

    assert response.status_code == 200
    assert response.data["status"] == "pending"


def test_tracking_does_not_read_the_gateway_for_a_closed_order(
    user_client, order, fake_gateway, monkeypatch
):
    """Une commande déjà clôturée n'a plus rien à relire."""
    Order.objects.filter(pk=order.pk).update(status=Order.Status.FAILED)
    monkeypatch.setattr(gateway, "fetch_payment", lambda ref: pytest.fail("relecture inutile"))
    age_payment(order)

    assert user_client.get(f"/api/orders/{order.id}/").data["status"] == "failed"


# --- Notifications Genius Pay -------------------------------------------------


def test_confirmed_payment_grants_access(api_client, order, fake_gateway):
    fake_gateway.settle(order.payment.reference, "completed")

    response = send_webhook(api_client, order.payment.reference)

    assert response.status_code == 200
    order.refresh_from_db()
    assert order.status == Order.Status.PAID
    assert order.paid_at is not None
    assert has_access(order)
    assert WebhookEvent.objects.get().processed_at is not None


def test_notification_alone_never_grants_access(api_client, order):
    """La notification annonce un succès, mais Genius Pay déclare toujours « pending »."""
    send_webhook(api_client, order.payment.reference, status="completed")

    order.refresh_from_db()
    assert order.status == Order.Status.PENDING
    assert not has_access(order)


def test_notification_with_invalid_signature_is_rejected(api_client, order, fake_gateway):
    fake_gateway.settle(order.payment.reference, "completed")

    response = send_webhook(api_client, order.payment.reference, secret="mauvais-secret")

    assert response.status_code == 401
    assert not WebhookEvent.objects.exists()
    assert not has_access(order)


def test_repeated_notification_is_recorded_and_applied_once(api_client, order, fake_gateway):
    fake_gateway.settle(order.payment.reference, "completed")

    for _ in range(3):
        send_webhook(api_client, order.payment.reference)

    assert WebhookEvent.objects.count() == 1
    assert Purchase.objects.count() == 1


def test_wrong_amount_does_not_grant_access(api_client, order, fake_gateway):
    fake_gateway.settle(order.payment.reference, "completed", amount=100)

    send_webhook(api_client, order.payment.reference)

    order.refresh_from_db()
    assert order.status == Order.Status.FAILED
    assert not has_access(order)


@pytest.mark.parametrize("remote_status", ["failed", "cancelled", "expired"])
def test_unsuccessful_payment_closes_the_order_without_access(
    api_client, order, fake_gateway, remote_status
):
    fake_gateway.settle(order.payment.reference, remote_status)

    send_webhook(api_client, order.payment.reference, status=remote_status)

    order.refresh_from_db()
    assert order.status == remote_status
    assert order.payment.status == remote_status
    assert not has_access(order)


def test_notification_for_unknown_payment_is_acknowledged(api_client):
    response = send_webhook(api_client, "MTX-INCONNU")

    assert response.status_code == 200
    assert WebhookEvent.objects.get().processed_at is not None


# --- Rattrapage des notifications perdues -------------------------------------


def age(order, minutes):
    Order.objects.filter(pk=order.pk).update(created_at=timezone.now() - timedelta(minutes=minutes))


def test_periodic_task_recovers_a_lost_notification(order, fake_gateway):
    fake_gateway.settle(order.payment.reference, "completed")
    age(order, minutes=6)

    sync_pending_payments()

    assert has_access(order)


def test_periodic_task_leaves_recent_orders_to_the_notification(order, fake_gateway):
    fake_gateway.settle(order.payment.reference, "completed")

    sync_pending_payments()

    assert not has_access(order)


def test_periodic_task_survives_a_gateway_outage(order, fake_gateway):
    age(order, minutes=6)
    fake_gateway.is_down = True

    sync_pending_payments()

    order.refresh_from_db()
    assert order.status == Order.Status.PENDING


# --- Back-office ---------------------------------------------------------------


def test_admin_lists_orders_with_their_payment(staff_client, order):
    response = staff_client.get("/api/admin/orders/?status=pending")

    assert response.status_code == 200
    assert response.data["results"] == [
        {
            "id": str(order.id),
            "client": "awa@example.com",
            "book": "Livre payant",
            "amount": 5000,
            "status": "pending",
            "created_at": response.data["results"][0]["created_at"],
            "paid_at": None,
            "payment_reference": "MTX-000001",
            "payment_status": "pending",
        }
    ]
    assert staff_client.get("/api/admin/orders/?status=paid").data["results"] == []


def test_admin_orders_are_forbidden_to_clients(user_client, api_client):
    assert api_client.get("/api/admin/orders/").status_code == 401
    assert user_client.get("/api/admin/orders/").status_code == 403


def test_ordered_book_cannot_be_deleted(staff_client, order):
    book = order.book

    response = staff_client.delete(f"/api/admin/books/{book.slug}/")

    assert response.status_code == 409
    assert book.file.storage.exists(book.file.name)


# --- Copie personnelle ---------------------------------------------------------


def test_confirmed_payment_prepares_the_personal_copy(
    api_client, order, fake_gateway, django_capture_on_commit_callbacks
):
    fake_gateway.settle(order.payment.reference, "completed")

    with django_capture_on_commit_callbacks(execute=True):
        send_webhook(api_client, order.payment.reference)

    assert Purchase.objects.get(order=order).is_ready


# --- Paiement simulé (développement) -------------------------------------------


def simulate(client, order, status):
    return client.post(f"/api/simulation/payments/{order.payment.reference}/", {"outcome": status})


@pytest.fixture
def simulated_order(user_client, paid_book, settings):
    """Commande créée avec le paiement simulé activé, sans faux prestataire."""
    settings.GENIUSPAY_SIMULATION = True
    response = user_client.post("/api/orders/", {"book": paid_book.slug})
    assert "/paiement-simule/SIM-" in response.data["payment_url"]
    return Order.objects.get(pk=response.data["id"])


def test_simulated_payment_grants_access_through_the_real_flow(user_client, simulated_order):
    response = simulate(user_client, simulated_order, "completed")

    assert response.status_code == 200
    assert response.data["status"] == "paid"
    assert has_access(simulated_order)


def test_simulated_failure_grants_nothing(user_client, simulated_order):
    assert simulate(user_client, simulated_order, "failed").data["status"] == "failed"
    assert not has_access(simulated_order)


def test_simulated_payment_belongs_to_its_client(user_client, simulated_order):
    stranger = User.objects.create_user(
        email="autre@example.com", password=PASSWORD, first_name="Autre", last_name="Client"
    )
    user_client.force_authenticate(stranger)

    assert simulate(user_client, simulated_order, "completed").status_code == 404
    assert not has_access(simulated_order)


def test_simulation_route_does_not_exist_when_disabled(user_client, simulated_order, settings):
    settings.GENIUSPAY_SIMULATION = False

    assert simulate(user_client, simulated_order, "completed").status_code == 404
    assert not has_access(simulated_order)


# --- Audit : devise, commandes abandonnées, paiement en double -----------------


def test_wrong_currency_does_not_grant_access(api_client, order, fake_gateway):
    fake_gateway.settle(order.payment.reference, "completed", currency="USD")

    send_webhook(api_client, order.payment.reference)

    order.refresh_from_db()
    assert order.status == Order.Status.FAILED
    assert not has_access(order)


def test_abandoned_order_expires_after_48_hours(order, fake_gateway):
    age(order, minutes=48 * 60 + 1)

    sync_pending_payments()

    order.refresh_from_db()
    assert order.status == Order.Status.EXPIRED


def test_late_payment_on_an_expired_order_still_grants_access(api_client, order, fake_gateway):
    Order.objects.filter(pk=order.pk).update(status=Order.Status.EXPIRED)
    fake_gateway.settle(order.payment.reference, "completed")

    send_webhook(api_client, order.payment.reference)

    order.refresh_from_db()
    assert order.status == Order.Status.PAID
    assert has_access(order)


def test_second_payment_for_an_owned_book_is_logged_for_refund(
    user, api_client, order, fake_gateway, caplog
):
    """
    Garde-fou : deux paiements du même livre ne donnent qu'un achat, le second à rembourser.

    L'API renvoie désormais vers le paiement en cours plutôt que d'en ouvrir un second,
    mais deux paiements peuvent encore se croiser (commande expirée puis payée en retard).
    """
    second = Order.objects.create(user=user, book=order.book, amount=order.amount)
    Payment.objects.create(
        order=second, reference="MTX-999999", status="pending", raw_response={}
    )
    fake_gateway.settle("MTX-999999", "completed", second.amount)

    for placed in (order, second):
        fake_gateway.settle(placed.payment.reference, "completed")
        send_webhook(api_client, placed.payment.reference)

    assert Purchase.objects.count() == 1
    assert "à rembourser" in caplog.text


def test_payment_created_without_status_is_pending(monkeypatch):
    """Genius Pay ne renvoie pas de statut à la création (vérifié en sandbox)."""
    created = type(
        "Payment",
        (),
        {
            "reference": "SANDBOX_1",
            "status": None,
            "amount": 500,
            "currency": "XOF",
            "checkout_url": "https://geniuspay.ci/checkout/SANDBOX_1",
            "payment_url": None,
            "_raw": {"reference": "SANDBOX_1"},
        },
    )()

    remote = gateway._call(lambda client: created)

    assert remote.status == "pending"


def test_notification_is_deduplicated_on_the_provider_event_id(api_client, order, fake_gateway):
    """Genius Pay numérote ses notifications : même `id` (même contenu ou non) = même événement."""
    fake_gateway.settle(order.payment.reference, "completed")

    for timestamp in (1, 2):
        send_webhook(api_client, order.payment.reference, id="evt-123", timestamp=timestamp)

    assert WebhookEvent.objects.get().event_id == "evt-123"
