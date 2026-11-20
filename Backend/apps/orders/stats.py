"""
Indicateurs du tableau de bord de l'administrateur.

Chaque indicateur de période est accompagné de sa valeur sur la période
précédente de même durée, pour afficher une évolution.
"""

from datetime import timedelta

from django.conf import settings
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import User
from apps.catalog.models import Book

from .models import Order

PERIOD_CHOICES = [7, 30, 90]
DEFAULT_PERIOD = 30
TOP_BOOKS = 5
RECENT_ORDERS = 5


def _between(field, start, end=None):
    """Filtre « `field` tombe entre le jour `start` inclus et le jour `end` exclu »."""
    condition = Q(**{f"{field}__date__gte": start})
    return condition & Q(**{f"{field}__date__lt": end}) if end else condition


def dashboard_stats(days=DEFAULT_PERIOD):
    """Calcule les indicateurs des `days` derniers jours, toujours en sept requêtes."""
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    previous_start = start - timedelta(days=days)

    paid = Q(status=Order.Status.PAID)
    paid_now, paid_before = _between("paid_at", start), _between("paid_at", previous_start, start)
    created_now = _between("created_at", start)
    created_before = _between("created_at", previous_start, start)

    orders = Order.objects.aggregate(
        revenue_total=Sum("amount", filter=paid, default=0),
        revenue_current=Sum("amount", filter=paid & paid_now, default=0),
        revenue_previous=Sum("amount", filter=paid & paid_before, default=0),
        paid_total=Count("id", filter=paid),
        paid_current=Count("id", filter=paid & paid_now),
        paid_previous=Count("id", filter=paid & paid_before),
        created_previous=Count("id", filter=created_before),
        converted_previous=Count("id", filter=paid & created_before),
        **{status: Count("id", filter=Q(status=status) & created_now) for status in Order.Status},
    )
    clients = User.objects.filter(is_staff=False).aggregate(
        total=Count("id"),
        current=Count("id", filter=created_now),
        previous=Count("id", filter=created_before),
    )
    books = Book.objects.filter(is_published=True).aggregate(
        free=Count("id", filter=Q(price__isnull=True)),
        paid=Count("id", filter=Q(price__isnull=False)),
    )
    by_day = {
        row["day"]: (row["revenue"], row["orders"])
        for row in Order.objects.filter(paid & paid_now)
        .values(day=TruncDate("paid_at"))
        .annotate(revenue=Sum("amount"), orders=Count("id"))
    }
    top_books = (
        Order.objects.filter(paid & paid_now)
        .values(slug=F("book__slug"), title=F("book__title"))
        .annotate(sales=Count("id"), revenue=Sum("amount"))
        .order_by("-sales", "-revenue")[:TOP_BOOKS]
    )
    top_rated = (
        Book.objects.with_ratings()
        .filter(rating_count__gt=0)
        .order_by("-rating_average", "-rating_count")
        .values("slug", "title", "rating_average", "rating_count")[:TOP_BOOKS]
    )
    by_status = {status.value: orders[status] for status in Order.Status}

    def evolution(name):
        return {"current": orders[f"{name}_current"], "previous": orders[f"{name}_previous"]}

    return {
        "currency": settings.CURRENCY,
        "period": {"days": days, "start": start, "end": today},
        "revenue": {"total": orders["revenue_total"], **evolution("revenue")},
        "paid_orders": {"total": orders["paid_total"], **evolution("paid")},
        "new_clients": clients,
        # Commandes lancées pendant la période, et combien ont abouti à un paiement.
        "conversion": {
            "created": {"current": sum(by_status.values()), "previous": orders["created_previous"]},
            "paid": {"current": by_status["paid"], "previous": orders["converted_previous"]},
        },
        "orders_by_status": by_status,
        "books": books,
        # Une entrée par jour, y compris les jours sans vente, pour tracer le graphique.
        "daily_revenue": [
            dict(zip(("date", "revenue", "orders"), (day, *by_day.get(day, (0, 0))), strict=True))
            for day in (start + timedelta(days=offset) for offset in range(days))
        ],
        "top_books": list(top_books),
        "top_rated": list(top_rated),
        "recent_orders": Order.objects.select_related("user", "book", "payment")[:RECENT_ORDERS],
    }
