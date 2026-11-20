"""Tests des notes (étoiles) et des annonces de nouveaux livres."""

from datetime import timedelta

import pytest
from django.db import IntegrityError
from django.utils import timezone

from apps.accounts.models import User
from apps.catalog.models import Book, Rating

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db


def rating_url(book):
    return f"/api/books/{book.slug}/rating/"


def other_user(email="autre@example.com"):
    return User.objects.create_user(
        email=email, password=PASSWORD, first_name="Autre", last_name="Client"
    )


# --- Notes --------------------------------------------------------------------


def test_client_rates_a_free_book_then_changes_the_rating(user_client, make_book):
    book = make_book()

    assert user_client.put(rating_url(book), {"stars": 4}).data == {"stars": 4}
    assert user_client.put(rating_url(book), {"stars": 2}).status_code == 200

    assert user_client.get(rating_url(book)).data == {"stars": 2}
    assert Rating.objects.count() == 1


def test_rating_requires_authentication(api_client, make_book):
    assert api_client.put(rating_url(make_book()), {"stars": 5}).status_code == 401


@pytest.mark.parametrize("stars", [0, 6, "beaucoup", None])
def test_rating_must_be_between_1_and_5(user_client, make_book, stars):
    response = user_client.put(rating_url(make_book()), {"stars": stars}, format="json")

    assert response.status_code == 400
    assert "stars" in response.data["errors"]


def test_database_rejects_an_out_of_range_rating(user, make_book):
    with pytest.raises(IntegrityError):
        Rating.objects.create(user=user, book=make_book(), stars=6)


def test_paid_book_can_only_be_rated_by_a_buyer(user_client, user, make_book, make_purchase):
    book = make_book(price=5000)

    refused = user_client.put(rating_url(book), {"stars": 5})
    assert refused.status_code == 403
    assert not Rating.objects.exists()

    make_purchase(user, book)
    assert user_client.put(rating_url(book), {"stars": 5}).status_code == 200


def test_unpublished_book_cannot_be_rated(user_client, make_book):
    book = make_book(is_published=False)

    assert user_client.put(rating_url(book), {"stars": 5}).status_code == 404


def test_client_removes_their_rating(user_client, make_book):
    book = make_book()
    user_client.put(rating_url(book), {"stars": 3})

    assert user_client.delete(rating_url(book)).status_code == 204
    assert user_client.get(rating_url(book)).status_code == 404


def test_catalogue_shows_average_and_count(api_client, user, make_book):
    rated, unrated = make_book(title="Noté"), make_book(title="Sans note")
    for index, stars in enumerate([5, 4, 4]):
        rater = user if index == 0 else other_user(f"client{index}@example.com")
        Rating.objects.create(user=rater, book=rated, stars=stars)

    detail = api_client.get(f"/api/books/{rated.slug}/").data
    assert (detail["rating_average"], detail["rating_count"]) == (4.3, 3)

    detail = api_client.get(f"/api/books/{unrated.slug}/").data
    assert (detail["rating_average"], detail["rating_count"]) == (None, 0)


def test_admin_sees_ratings_and_the_best_rated_books(staff_client, user, make_book):
    best, good = make_book(title="Excellent"), make_book(title="Bon")
    make_book(title="Sans note")
    Rating.objects.create(user=user, book=best, stars=5)
    Rating.objects.create(user=user, book=good, stars=3)

    books = {book["title"]: book for book in staff_client.get("/api/admin/books/").data["results"]}
    assert books["Excellent"]["rating_average"] == 5.0
    assert books["Sans note"]["rating_count"] == 0

    assert staff_client.get("/api/admin/stats/").data["top_rated"] == [
        {"slug": best.slug, "title": "Excellent", "rating_average": 5.0, "rating_count": 1},
        {"slug": good.slug, "title": "Bon", "rating_average": 3.0, "rating_count": 1},
    ]


# --- Nouveautés ---------------------------------------------------------------


def test_publication_date_is_set_once(make_book):
    draft = make_book(is_published=False)
    assert draft.published_at is None

    draft.is_published = True
    draft.save()
    first_publication = draft.published_at
    assert first_publication is not None

    draft.is_published = False
    draft.save()
    draft.is_published = True
    draft.save()
    assert draft.published_at == first_publication


def test_new_book_is_announced_until_the_client_reads_it(user_client, user, make_book):
    make_book(title="Ancien")  # publié avant la dernière lecture du client
    user.notifications_read_at = timezone.now()
    user.save()
    make_book(title="Nouveau")

    notifications = user_client.get("/api/notifications/").data
    assert [(n["book"]["title"], n["is_read"]) for n in notifications] == [
        ("Nouveau", False),
        ("Ancien", True),
    ]

    assert user_client.post("/api/notifications/read/").status_code == 204
    assert all(n["is_read"] for n in user_client.get("/api/notifications/").data)


def test_notifications_skip_drafts_and_old_publications(user_client, make_book):
    make_book(title="Brouillon", is_published=False)
    old = make_book(title="Publié il y a longtemps")
    Book.objects.filter(pk=old.pk).update(published_at=timezone.now() - timedelta(days=31))

    assert user_client.get("/api/notifications/").data == []


def test_notifications_require_authentication(api_client):
    assert api_client.get("/api/notifications/").status_code == 401
    assert api_client.post("/api/notifications/read/").status_code == 401


def test_reading_notifications_only_affects_the_current_client(user_client, make_book):
    stranger = other_user()
    make_book(title="Nouveau")
    stranger.refresh_from_db()

    user_client.post("/api/notifications/read/")

    user_client.force_authenticate(stranger)
    assert [n["is_read"] for n in user_client.get("/api/notifications/").data] == [False]
