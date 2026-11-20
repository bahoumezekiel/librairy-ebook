"""Tests de la bibliothèque : livres achetés, copie filigranée et chiffrée, licences."""

import io
import uuid
import zipfile
from base64 import b64decode
from datetime import timedelta

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.core.files.base import ContentFile
from django.utils import timezone
from pypdf import PdfReader

from apps.accounts.models import User
from apps.catalog.models import Book
from apps.library.models import DeviceLicense
from apps.library.tasks import prepare_purchase_copy

from .conftest import BOOK_CONTENT, PASSWORD

pytestmark = pytest.mark.django_db


@pytest.fixture
def purchase(user, make_book, make_purchase):
    """Achat du client dont la copie personnelle est prête."""
    purchase = make_purchase(user, make_book(title="Livre payant", price=5000))
    prepare_purchase_copy(purchase.pk)
    purchase.refresh_from_db()
    return purchase


def license_url(purchase):
    return f"/api/library/{purchase.book.slug}/license/"


def file_url(purchase):
    return f"/api/library/{purchase.book.slug}/file/"


def request_license(client, purchase, device_id=None, name="Téléphone"):
    return client.post(
        license_url(purchase), {"device_id": device_id or uuid.uuid4(), "name": name}
    )


def download_and_decrypt(client, purchase):
    """Suit le parcours du lecteur : licence, fichier chiffré, déchiffrement AES-GCM."""
    key = b64decode(request_license(client, purchase).data["key"])
    encrypted = b"".join(client.get(file_url(purchase)).streaming_content)
    return AESGCM(key).decrypt(encrypted[:12], encrypted[12:], None), encrypted


# --- Liste des livres achetés -------------------------------------------------


def test_library_lists_only_the_client_own_books(user_client, purchase, make_book, make_purchase):
    stranger = User.objects.create_user(
        email="autre@example.com", password=PASSWORD, first_name="Autre", last_name="Client"
    )
    make_purchase(stranger, make_book(title="Livre d'un autre", price=3000))

    response = user_client.get("/api/library/")

    assert response.status_code == 200
    assert [item["book"]["title"] for item in response.data] == ["Livre payant"]
    assert response.data[0]["is_ready"] is True


def test_library_requires_authentication(api_client, purchase):
    assert api_client.get("/api/library/").status_code == 401
    assert api_client.post(license_url(purchase)).status_code == 401
    assert api_client.get(file_url(purchase)).status_code == 401


def test_unpurchased_book_is_not_accessible(user_client, make_book):
    book = make_book(price=5000)

    assert user_client.post(f"/api/library/{book.slug}/license/").status_code == 404
    assert user_client.get(f"/api/library/{book.slug}/file/").status_code == 404


# --- Copie personnelle --------------------------------------------------------


def test_pdf_copy_is_watermarked_on_every_page_and_encrypted(user_client, purchase):
    decrypted, encrypted = download_and_decrypt(user_client, purchase)

    pages = [page.extract_text() for page in PdfReader(io.BytesIO(decrypted)).pages]
    assert len(pages) == 2
    for number, text in enumerate(pages, start=1):
        assert f"Contenu de la page {number}" in text
        assert "Exemplaire personnel de Awa Traoré – awa@example.com" in text
    assert not encrypted.startswith(b"%PDF")


def test_epub_copy_is_encrypted_without_modification(user_client, user, make_book, make_purchase):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("mimetype", "application/epub+zip")
    epub = buffer.getvalue()
    book = make_book(price=5000, format=Book.Format.EPUB, file=ContentFile(epub, name="l.epub"))
    purchase = make_purchase(user, book)
    prepare_purchase_copy(purchase.pk)

    decrypted, _ = download_and_decrypt(user_client, purchase)

    assert decrypted == epub


def test_each_purchase_has_its_own_key_and_the_original_stays_untouched(
    user, purchase, make_book, make_purchase
):
    other = make_purchase(user, make_book(title="Autre livre", price=3000))
    prepare_purchase_copy(other.pk)
    other.refresh_from_db()

    assert len(bytes(purchase.encryption_key)) == 32
    assert bytes(purchase.encryption_key) != bytes(other.encryption_key)
    assert purchase.book.file.read() == BOOK_CONTENT


def test_preparing_a_copy_twice_keeps_the_first_one(purchase):
    key, name = bytes(purchase.encryption_key), purchase.encrypted_copy.name

    prepare_purchase_copy(purchase.pk)

    purchase.refresh_from_db()
    assert (bytes(purchase.encryption_key), purchase.encrypted_copy.name) == (key, name)


def test_copy_not_ready_is_reported_then_prepared(user_client, user, make_book, make_purchase):
    purchase = make_purchase(user, make_book(price=5000))

    first = user_client.get(file_url(purchase))
    second = user_client.get(file_url(purchase))

    assert first.status_code == 409
    assert first.data["code"] == "copy_not_ready"
    assert second.status_code == 200


# --- Licences d'appareil ------------------------------------------------------


def test_license_returns_the_key_and_expires_in_30_days(user_client, purchase):
    response = request_license(user_client, purchase)

    assert response.status_code == 200
    assert b64decode(response.data["key"]) == bytes(purchase.encryption_key)
    remaining = DeviceLicense.objects.get().expires_at - timezone.now()
    assert timedelta(days=29, hours=23) < remaining <= timedelta(days=30)


def test_license_renewal_keeps_one_license_per_device(user_client, purchase):
    device_id = uuid.uuid4()
    request_license(user_client, purchase, device_id)
    DeviceLicense.objects.update(expires_at=timezone.now() + timedelta(days=1))

    request_license(user_client, purchase, device_id, name="Téléphone renommé")

    renewed = DeviceLicense.objects.get()
    assert renewed.name == "Téléphone renommé"
    assert renewed.expires_at > timezone.now() + timedelta(days=29)


def test_fourth_device_is_refused_but_known_devices_can_renew(user_client, purchase):
    devices = [uuid.uuid4() for _ in range(3)]
    for device_id in devices:
        assert request_license(user_client, purchase, device_id).status_code == 200

    refused = request_license(user_client, purchase)

    assert refused.status_code == 409
    assert refused.data["code"] == "device_limit_reached"
    assert request_license(user_client, purchase, devices[0]).status_code == 200


def test_expired_license_frees_its_place(user_client, purchase):
    for _ in range(3):
        request_license(user_client, purchase)
    oldest = DeviceLicense.objects.order_by("id").first()
    DeviceLicense.objects.filter(pk=oldest.pk).update(expires_at=timezone.now())

    assert request_license(user_client, purchase).status_code == 200


def test_license_requires_a_valid_device(user_client, purchase):
    response = user_client.post(license_url(purchase), {"device_id": "pas-un-uuid"})

    assert response.status_code == 400
    assert set(response.data["errors"]) == {"device_id", "name"}


# --- Audit : bibliothèque complète et achat précis -------------------------------


def test_library_lists_every_purchase_without_pagination(
    user_client, user, make_book, make_purchase
):
    for number in range(25):
        make_purchase(user, make_book(title=f"Livre {number}", price=1000))

    assert len(user_client.get("/api/library/").data) == 25


def test_one_purchase_can_be_read_directly(user_client, purchase, make_book):
    response = user_client.get(f"/api/library/{purchase.book.slug}/")

    assert response.status_code == 200
    assert response.data["book"]["slug"] == purchase.book.slug
    assert user_client.get(f"/api/library/{make_book(price=1000).slug}/").status_code == 404
