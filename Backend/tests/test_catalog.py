"""Tests du catalogue public : catégories, livres, filtres, recherche, téléchargement."""

import pytest
import requests
from django.db import IntegrityError

from apps.catalog.models import Category, Rating

from .conftest import BOOK_CONTENT

pytestmark = pytest.mark.django_db


def titles(response):
    return [book["title"] for book in response.data["results"]]


# --- Modèles ------------------------------------------------------------------


def test_slug_is_generated_and_unique(make_book):
    first, second = make_book(), make_book()

    assert first.slug == "securite-des-reseaux"
    assert second.slug == "securite-des-reseaux-2"


def test_slug_is_kept_when_the_title_changes(make_book):
    book = make_book()
    book.title = "Nouveau titre"
    book.save()

    assert book.slug == "securite-des-reseaux"


def test_uploaded_file_names_are_regenerated(make_book):
    book = make_book()

    assert book.file.name.startswith("books/") and book.file.name.endswith(".pdf")
    assert book.cover.name.startswith("covers/") and book.cover.name.endswith(".png")
    assert "Mon Livre" not in book.file.name


def test_paid_book_requires_a_positive_price(make_book):
    with pytest.raises(IntegrityError):
        make_book(price=0)


# --- Catégories ---------------------------------------------------------------


def test_categories_are_public_and_ordered_by_position(api_client, category):
    Category.objects.create(name="Data Science", position=1)
    category.position = 2
    category.save()

    response = api_client.get("/api/categories/")

    assert response.status_code == 200
    assert [item["slug"] for item in response.data] == ["data-science", "cybersecurite"]


# --- Livres -------------------------------------------------------------------


def test_catalogue_lists_only_published_books(api_client, make_book):
    make_book()
    make_book(title="Brouillon", is_published=False)

    response = api_client.get("/api/books/")

    assert response.status_code == 200
    assert titles(response) == ["Sécurité des réseaux"]


def test_book_detail_exposes_public_fields_only(api_client, make_book):
    book = make_book(price=5000)

    response = api_client.get(f"/api/books/{book.slug}/")

    assert response.status_code == 200
    assert set(response.data) == {
        "slug",
        "title",
        "author",
        "description",
        "cover",
        "category",
        "format",
        "is_free",
        "price",
        "published_at",
        "rating_average",
        "rating_count",
    }
    assert response.data["is_free"] is False
    assert response.data["price"] == 5000
    assert response.data["category"]["slug"] == "cybersecurite"


def test_cover_is_publicly_readable(api_client, make_book):
    book = make_book()

    cover_url = api_client.get(f"/api/books/{book.slug}/").data["cover"]

    assert "Signature" not in cover_url
    assert requests.get(cover_url, timeout=10).content == b"image"


def test_unpublished_book_is_not_found(api_client, make_book):
    book = make_book(is_published=False)

    assert api_client.get(f"/api/books/{book.slug}/").status_code == 404
    assert api_client.get(f"/api/books/{book.slug}/download/").status_code == 404


# --- Filtres et recherche -----------------------------------------------------


def test_filter_by_category(api_client, make_book):
    make_book()
    make_book(title="Pandas", category=Category.objects.create(name="Data Analysis"))

    assert titles(api_client.get("/api/books/?category=data-analysis")) == ["Pandas"]


def test_filter_by_free_or_paid(api_client, make_book):
    make_book(title="Gratuit")
    make_book(title="Payant", price=3000)

    assert titles(api_client.get("/api/books/?is_free=true")) == ["Gratuit"]
    assert titles(api_client.get("/api/books/?is_free=false")) == ["Payant"]


@pytest.mark.parametrize("keyword", ["réseau", "RESEAUX", "securite", "traore", "entreprise"])
def test_search_matches_title_author_and_description(api_client, make_book, keyword):
    make_book()
    make_book(title="Pandas", author="Moussa Ouédraogo", description="Analyser des données.")

    assert titles(api_client.get("/api/books/", {"search": keyword})) == ["Sécurité des réseaux"]


def test_search_ranks_title_matches_first(api_client, make_book):
    make_book(title="Django", description="Construire une API.")
    make_book(title="Construire une API", description="Avec Django.")

    assert titles(api_client.get("/api/books/?search=django")) == ["Django", "Construire une API"]


def test_filters_combine(api_client, make_book):
    make_book(title="Réseaux gratuits")
    make_book(title="Réseaux payants", price=2000)

    response = api_client.get("/api/books/?search=réseaux&is_free=false&category=cybersecurite")

    assert titles(response) == ["Réseaux payants"]


# --- Téléchargement -----------------------------------------------------------


def test_free_book_is_handed_over_by_the_api(api_client, make_book):
    """Le fichier est relayé par l'API : le stockage objet reste hors d'atteinte."""
    book = make_book()

    response = api_client.get(f"/api/books/{book.slug}/download/")

    assert response.status_code == 200
    assert b"".join(response.streaming_content) == BOOK_CONTENT
    assert f'filename="{book.slug}.pdf"' in response.headers["Content-Disposition"]


def test_book_file_is_not_readable_without_signature(make_book):
    book = make_book()
    unsigned_url = book.file.url.split("?")[0]

    assert requests.get(unsigned_url, timeout=10).status_code == 403


def test_paid_book_cannot_be_downloaded(api_client, make_book):
    book = make_book(price=5000)

    response = api_client.get(f"/api/books/{book.slug}/download/")

    assert response.status_code == 403
    assert response.data["code"] == "permission_denied"


# --- Tri ----------------------------------------------------------------------


def test_catalogue_can_be_sorted_by_rating_and_price(api_client, user, make_book):
    cheap = make_book(title="Petit prix", price=1000)
    costly = make_book(title="Grand prix", price=9000)
    free = make_book(title="Gratuit")
    Rating.objects.create(user=user, book=cheap, stars=5)
    Rating.objects.create(user=user, book=free, stars=3)

    def sorted_by(sort):
        return titles(api_client.get(f"/api/books/?sort={sort}"))

    assert sorted_by("rating") == ["Petit prix", "Gratuit", "Grand prix"]
    assert sorted_by("price_asc") == ["Gratuit", "Petit prix", "Grand prix"]
    assert sorted_by("price_desc") == ["Grand prix", "Petit prix", "Gratuit"]
    assert titles(api_client.get("/api/books/")) == ["Gratuit", "Grand prix", "Petit prix"]
    assert costly.slug


def test_unknown_sort_is_rejected(api_client):
    assert api_client.get("/api/books/?sort=hasard").status_code == 400
