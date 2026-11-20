"""Tests du back-office : accès, catégories, livres et fichiers téléversés, clients."""

import io
import zipfile

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from pypdf import PdfWriter

from apps.catalog import validators
from apps.catalog.models import Book, Category

from .conftest import BOOK_CONTENT

pytestmark = pytest.mark.django_db

ADMIN_ROUTES = ["/api/admin/categories/", "/api/admin/books/", "/api/admin/users/"]


def image_file(image_format="PNG", name="photo.png"):
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), "#EC6616").save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue())


def pdf_file(name="document.bin"):
    return SimpleUploadedFile(name, BOOK_CONTENT)


def epub_file(mimetype=b"application/epub+zip"):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("mimetype", mimetype)
    return SimpleUploadedFile("livre.bin", buffer.getvalue())


def book_payload(category, **fields):
    return {
        "title": "Apprendre Django",
        "author": "Awa Traoré",
        "description": "Construire une API REST.",
        "category": category.slug,
        "cover": image_file(),
        "file": pdf_file(),
        **fields,
    }


def create_book(staff_client, category, **fields):
    return staff_client.post("/api/admin/books/", book_payload(category, **fields))


def stored(field):
    return field.storage.exists(field.name)


# --- Accès --------------------------------------------------------------------


@pytest.mark.parametrize("route", ADMIN_ROUTES)
def test_admin_routes_reject_visitors_and_clients(api_client, user_client, route):
    assert api_client.get(route).status_code == 401
    assert user_client.get(route).status_code == 403


@pytest.mark.parametrize("route", ADMIN_ROUTES)
def test_admin_routes_accept_the_administrator(staff_client, route):
    assert staff_client.get(route).status_code == 200


# --- Catégories ---------------------------------------------------------------


def test_category_lifecycle(staff_client):
    created = staff_client.post("/api/admin/categories/", {"name": "Data Science", "position": 1})
    assert created.status_code == 201
    assert created.data["slug"] == "data-science"

    updated = staff_client.patch("/api/admin/categories/data-science/", {"position": 3})
    assert updated.data["position"] == 3

    assert staff_client.delete("/api/admin/categories/data-science/").status_code == 204
    assert not Category.objects.exists()


def test_category_with_books_cannot_be_deleted(staff_client, make_book):
    book = make_book()

    response = staff_client.delete(f"/api/admin/categories/{book.category.slug}/")

    assert response.status_code == 409
    assert response.data["code"] == "conflict"
    assert Category.objects.filter(pk=book.category_id).exists()


# --- Livres -------------------------------------------------------------------


def test_create_free_pdf_book(staff_client, category):
    response = create_book(staff_client, category)

    assert response.status_code == 201
    assert response.data["format"] == "pdf"
    assert response.data["is_free"] is True
    assert response.data["is_published"] is False
    assert "file" not in response.data
    book = Book.objects.get(slug=response.data["slug"])
    assert book.file.read() == BOOK_CONTENT


def test_create_paid_epub_book(staff_client, category):
    response = create_book(staff_client, category, file=epub_file(), price=5000)

    assert response.status_code == 201
    assert response.data["format"] == "epub"
    assert response.data["is_free"] is False


def test_stored_extensions_follow_the_real_content(staff_client, category):
    response = create_book(
        staff_client,
        category,
        file=pdf_file(name="virus.exe"),
        cover=image_file("JPEG", name="image.png"),
    )

    book = Book.objects.get(slug=response.data["slug"])
    assert book.file.name.endswith(".pdf")
    assert book.cover.name.endswith(".jpg")


@pytest.mark.parametrize(
    ("field", "upload"),
    [
        ("file", lambda: SimpleUploadedFile("faux.pdf", b"ceci n'est pas un PDF")),
        ("file", lambda: SimpleUploadedFile("abime.pdf", b"%PDF-1.7 fichier tronque")),
        ("file", lambda: epub_file(mimetype=b"application/zip")),
        ("cover", lambda: SimpleUploadedFile("faux.png", b"ceci n'est pas une image")),
        ("cover", lambda: image_file("GIF")),
    ],
)
def test_upload_with_wrong_content_is_rejected(staff_client, category, field, upload):
    response = create_book(staff_client, category, **{field: upload()})

    assert response.status_code == 400
    assert list(response.data["errors"]) == [field]
    assert not Book.objects.exists()


@pytest.mark.parametrize(
    ("field", "limit"), [("file", "MAX_BOOK_SIZE"), ("cover", "MAX_COVER_SIZE")]
)
def test_upload_over_the_size_limit_is_rejected(staff_client, category, monkeypatch, field, limit):
    monkeypatch.setattr(validators, limit, 8)

    response = create_book(staff_client, category)

    assert response.status_code == 400
    assert field in response.data["errors"]


def test_price_below_the_payment_minimum_is_rejected(staff_client, category):
    response = create_book(staff_client, category, price=199)

    assert response.status_code == 400
    assert "price" in response.data["errors"]


def test_publishing_makes_the_book_visible_in_the_catalogue(staff_client, api_client, category):
    slug = create_book(staff_client, category).data["slug"]
    assert api_client.get(f"/api/books/{slug}/").status_code == 404

    staff_client.patch(f"/api/admin/books/{slug}/", {"is_published": True})
    assert api_client.get(f"/api/books/{slug}/").status_code == 200

    staff_client.patch(f"/api/admin/books/{slug}/", {"is_published": False})
    assert api_client.get(f"/api/books/{slug}/").status_code == 404


def test_paid_book_becomes_free_when_price_is_emptied(staff_client, make_book):
    book = make_book(price=5000)

    response = staff_client.patch(f"/api/admin/books/{book.slug}/", {"price": None}, format="json")

    assert response.data["is_free"] is True


def test_replacing_the_file_updates_format_and_removes_the_old_file(staff_client, make_book):
    book = make_book()
    old_file, old_cover = book.file, book.cover

    response = staff_client.patch(f"/api/admin/books/{book.slug}/", {"file": epub_file()})

    assert response.data["format"] == "epub"
    assert not stored(old_file)
    assert stored(old_cover)


def test_deleting_a_book_removes_its_files(staff_client, make_book):
    book = make_book()

    assert staff_client.delete(f"/api/admin/books/{book.slug}/").status_code == 204
    assert not Book.objects.exists()
    assert not stored(book.file) and not stored(book.cover)


def test_admin_lists_unpublished_books(staff_client, make_book):
    make_book(title="Brouillon", is_published=False)

    response = staff_client.get("/api/admin/books/")

    assert [book["title"] for book in response.data["results"]] == ["Brouillon"]


# --- Clients ------------------------------------------------------------------


def test_clients_list_excludes_administrators(staff_client, user):
    response = staff_client.get("/api/admin/users/")

    assert [client["email"] for client in response.data["results"]] == [user.email]
    assert set(response.data["results"][0]) == {
        "id",
        "email",
        "first_name",
        "last_name",
        "created_at",
    }


# --- Audit : fichiers piégés ----------------------------------------------------


def encrypted_pdf():
    writer = PdfWriter(clone_from=io.BytesIO(BOOK_CONTENT))
    writer.encrypt("secret")
    buffer = io.BytesIO()
    writer.write(buffer)
    return SimpleUploadedFile("protege.pdf", buffer.getvalue())


@pytest.mark.parametrize(
    ("upload", "message"),
    [
        (encrypted_pdf, "protégé par un mot de passe"),
        (
            lambda: SimpleUploadedFile("casse.pdf", b"%PDF-1.7\n" + bytes(range(256)) * 40),
            "endommagé",
        ),
    ],
)
def test_unusable_pdf_is_rejected_without_server_error(staff_client, category, upload, message):
    response = create_book(staff_client, category, file=upload())

    assert response.status_code == 400
    assert message in str(response.data["errors"]["file"])


def test_oversized_cover_dimensions_are_rejected(staff_client, category, monkeypatch):
    monkeypatch.setattr(validators, "MAX_COVER_SIDE", 3)

    response = create_book(staff_client, category)

    assert response.status_code == 400
    assert "pixels" in str(response.data["errors"]["cover"])


def test_title_without_latin_letters_still_gets_a_slug(staff_client, category):
    response = create_book(staff_client, category, title="数据科学")

    assert response.status_code == 201
    assert response.data["slug"] == "book"


def test_very_long_original_filenames_are_accepted(staff_client, category):
    """Le nom d'origine est remplacé : sa longueur ne doit pas empêcher l'envoi."""
    long_name = "nom-de-fichier-tres-long-" * 8  # 200 caractères

    response = create_book(
        staff_client,
        category,
        cover=image_file(name=f"{long_name}.png"),
        file=SimpleUploadedFile(f"{long_name}.pdf", BOOK_CONTENT),
    )

    assert response.status_code == 201
    book = Book.objects.get(slug=response.data["slug"])
    assert len(book.cover.name) < 50 and len(book.file.name) < 50
