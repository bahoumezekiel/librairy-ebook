"""Routes du back-office pour les comptes, montées sous /api/admin/."""

from django.urls import path

from . import admin_views

urlpatterns = [
    path("users/", admin_views.AdminClientListView.as_view(), name="admin-user-list"),
]
