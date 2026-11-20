"""Routes du back-office pour les commandes, montées sous /api/admin/."""

from django.urls import path

from . import admin_views

urlpatterns = [
    path("orders/", admin_views.AdminOrderListView.as_view(), name="admin-order-list"),
    path("stats/", admin_views.AdminStatsView.as_view(), name="admin-stats"),
]
