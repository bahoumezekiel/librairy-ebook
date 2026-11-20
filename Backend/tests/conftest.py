"""Fixtures partagées par les tests."""

from decimal import Decimal
from io import BytesIO

import pytest
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.core.management import call_command
from django.utils import timezone
from reportlab.pdfgen import canvas
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Book, Category
from apps.library.models import Purchase
from apps.orders import gateway
from apps.orders.models import Order
from config.celery import app as celery_app

PASSWORD = "Motdepasse-Solide-2026"


def make_pdf(pages=2):
    """Vrai PDF de quelques pages, chacune avec une ligne de texte."""
    buffer = BytesIO()
    document = canvas.Canvas(buffer)
    for number in range(1, pages + 1):
        document.drawString(72, 720, f"Contenu de la page {number}")
        document.showPage()
    document.save()
    return buffer.getvalue()


BOOK_CONTENT = make_pdf()


@pytest.fixture(scope="session", autouse=True)
def test_storage():
    """Isole les tests dans des espaces de stockage dédiés, supprimés en fin de session."""
    test_storages = [storages[alias] for alias in ("default", "public")]
    for storage in test_storages:
        storage.bucket_name = f"test-{storage.bucket_name}"
    call_command("setup_storage")
    yield
    for storage in test_storages:
        storage.bucket.objects.all().delete()
        storage.bucket.delete()


@pytest.fixture(scope="session", autouse=True)
def eager_celery():
    """Exécute les tâches Celery immédiatement, sans file ni processus séparé."""
    celery_app.conf.update(task_always_eager=True, task_eager_propagates=True)


class FakeGateway:
    """Genius Pay simulé : mémorise les paiements créés et laisse le test fixer leur état."""

    def __init__(self):
        self.payments = {}
        self.is_down = False
        # Compteur propre, et non la taille du dictionnaire : une référence oubliée par
        # le prestataire ne doit pas être réattribuée à un nouveau paiement.
        self.created = 0

    def create_payment(self, order):
        self._check_available()
        self.created += 1
        return self.settle(f"MTX-{self.created:06}", "pending", order.amount)

    def fetch_payment(self, reference):
        self._check_available()
        if reference not in self.payments:
            # Comme Genius Pay : une référence inconnue est une erreur de la passerelle.
            raise gateway.GatewayError()
        return self.payments[reference]

    def settle(self, reference, status, amount=None, currency="XOF"):
        """Fixe le statut (et le montant, la devise) que Genius Pay déclarera pour ce paiement."""
        if amount is None:
            amount = self.payments[reference].amount
        self.payments[reference] = gateway.RemotePayment(
            reference=reference,
            status=status,
            amount=Decimal(amount),
            currency=currency,
            url=f"https://pay.example/{reference}",
            raw={"reference": reference, "status": status, "amount": int(amount)},
        )
        return self.payments[reference]

    def _check_available(self):
        if self.is_down:
            raise gateway.GatewayError()


@pytest.fixture
def fake_gateway(monkeypatch):
    fake = FakeGateway()
    monkeypatch.setattr(gateway, "create_payment", fake.create_payment)
    monkeypatch.setattr(gateway, "fetch_payment", fake.fetch_payment)
    return fake


@pytest.fixture(autouse=True)
def clear_cache():
    """Remet à zéro les compteurs de limitation entre deux tests."""
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="awa@example.com", password=PASSWORD, first_name="Awa", last_name="Traoré"
    )


@pytest.fixture
def user_client(user):
    """Client HTTP authentifié comme simple client."""
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def staff_client(db):
    """Client HTTP authentifié comme administrateur."""
    admin = User.objects.create_superuser(
        email="admin@example.com", password=PASSWORD, first_name="Ada", last_name="Min"
    )
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.fixture
def category(db):
    return Category.objects.create(name="Cybersécurité")


@pytest.fixture
def make_book(category):
    """Fabrique de livres publiés, gratuits par défaut."""

    def factory(**fields):
        defaults = {
            "category": category,
            "title": "Sécurité des réseaux",
            "author": "Awa Traoré",
            "description": "Protéger le réseau d'une entreprise.",
            "cover": ContentFile(b"image", name="Ma Couverture.PNG"),
            "file": ContentFile(BOOK_CONTENT, name="Mon Livre.pdf"),
            "format": Book.Format.PDF,
            "is_published": True,
        }
        return Book.objects.create(**defaults | fields)

    return factory


@pytest.fixture
def make_purchase():
    """Fabrique d'achats : commande payée et achat, sans copie chiffrée préparée."""

    def factory(user, book):
        order = Order.objects.create(
            user=user,
            book=book,
            amount=book.price,
            status=Order.Status.PAID,
            paid_at=timezone.now(),
        )
        return Purchase.objects.create(user=user, book=book, order=order)

    return factory
