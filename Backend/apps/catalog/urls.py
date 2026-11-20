"""Routes publiques du catalogue, montées sous /api/."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("books", views.BookViewSet, basename="book")

urlpatterns = [
    path("categories/", views.CategoryListView.as_view(), name="category-list"),
    path("notifications/", views.NotificationListView.as_view(), name="notification-list"),
    path("notifications/read/", views.NotificationReadView.as_view(), name="notification-read"),
    *router.urls,
]
