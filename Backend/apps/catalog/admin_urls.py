"""Routes du back-office pour le catalogue, montées sous /api/admin/."""

from rest_framework.routers import SimpleRouter

from . import admin_views

router = SimpleRouter()
router.register("categories", admin_views.AdminCategoryViewSet, basename="admin-category")
router.register("books", admin_views.AdminBookViewSet, basename="admin-book")

urlpatterns = router.urls
