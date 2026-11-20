"""Tests des indicateurs du tableau de bord."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.catalog.models import Rating
from apps.orders.models import Order

pytestmark = pytest.mark.django_db

NO_EVOLUTION = {"current": 0, "previous": 0}


def test_stats_are_reserved_to_the_administrator(api_client, user_client):
    assert api_client.get("/api/admin/stats/").status_code == 401
    assert user_client.get("/api/admin/stats/").status_code == 403


def test_stats_without_any_activity(staff_client):
    data = staff_client.get("/api/admin/stats/").data

    assert data["currency"] == "XOF"
    assert data["period"]["days"] == 30
    assert data["revenue"] == {"total": 0, **NO_EVOLUTION}
    assert data["paid_orders"] == {"total": 0, **NO_EVOLUTION}
    assert data["new_clients"] == {"total": 0, **NO_EVOLUTION}
    assert data["conversion"] == {"created": NO_EVOLUTION, "paid": NO_EVOLUTION}
    assert data["orders_by_status"] == {
        "pending": 0,
        "paid": 0,
        "failed": 0,
        "cancelled": 0,
        "expired": 0,
    }
    assert data["books"] == {"free": 0, "paid": 0}
    assert data["top_books"] == data["top_rated"] == data["recent_orders"] == []
    assert len(data["daily_revenue"]) == 30
    assert data["daily_revenue"][-1] == {"date": timezone.localdate(), "revenue": 0, "orders": 0}


@pytest.mark.parametrize("days", [7, 30, 90])
def test_period_length_follows_the_days_parameter(staff_client, days):
    data = staff_client.get(f"/api/admin/stats/?days={days}").data

    assert data["period"] == {
        "days": days,
        "start": timezone.localdate() - timedelta(days=days - 1),
        "end": timezone.localdate(),
    }
    assert len(data["daily_revenue"]) == days


@pytest.mark.parametrize("days", ["0", "15", "abc"])
def test_unsupported_period_is_rejected(staff_client, days):
    response = staff_client.get(f"/api/admin/stats/?days={days}")

    assert response.status_code == 400
    assert "days" in response.data["errors"]


def test_stats_compare_the_period_with_the_previous_one(staff_client, user, make_book):
    now = timezone.now()
    bestseller = make_book(title="Succès", price=5000)
    other = make_book(title="Autre", price=2000)
    make_book(title="Gratuit")
    make_book(title="Brouillon", price=9000, is_published=False)
    Rating.objects.create(user=user, book=bestseller, stars=4)
    User.objects.filter(pk=user.pk).update(created_at=now - timedelta(days=40))

    def order(book, days_ago=0, status=Order.Status.PAID):
        created = now - timedelta(days=days_ago)
        placed = Order.objects.create(
            user=user,
            book=book,
            amount=book.price,
            status=status,
            paid_at=created if status == Order.Status.PAID else None,
        )
        Order.objects.filter(pk=placed.pk).update(created_at=created)

    order(bestseller)
    order(other, days_ago=1)
    order(other, status=Order.Status.PENDING)
    order(other, status=Order.Status.FAILED)
    order(bestseller, days_ago=40)  # période précédente
    order(other, days_ago=45, status=Order.Status.CANCELLED)  # période précédente
    order(bestseller, days_ago=100)  # avant les deux périodes

    data = staff_client.get("/api/admin/stats/").data

    assert data["revenue"] == {"total": 17000, "current": 7000, "previous": 5000}
    assert data["paid_orders"] == {"total": 4, "current": 2, "previous": 1}
    assert data["new_clients"] == {"total": 1, "current": 0, "previous": 1}
    assert data["conversion"] == {
        "created": {"current": 4, "previous": 2},
        "paid": {"current": 2, "previous": 1},
    }
    assert data["orders_by_status"] == {
        "pending": 1,
        "paid": 2,
        "failed": 1,
        "cancelled": 0,
        "expired": 0,
    }
    assert data["books"] == {"free": 1, "paid": 2}
    assert data["daily_revenue"][-1] == {"date": timezone.localdate(), "revenue": 5000, "orders": 1}
    assert sum(day["revenue"] for day in data["daily_revenue"]) == 7000
    assert data["top_books"] == [
        {"slug": bestseller.slug, "title": "Succès", "sales": 1, "revenue": 5000},
        {"slug": other.slug, "title": "Autre", "sales": 1, "revenue": 2000},
    ]
    assert data["top_rated"] == [
        {"slug": bestseller.slug, "title": "Succès", "rating_average": 4.0, "rating_count": 1}
    ]
    assert len(data["recent_orders"]) == 5
    assert data["recent_orders"][0]["client"] == user.email
