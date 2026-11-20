"""Routes de la bibliothèque personnelle, montées sous /api/."""

from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("library", views.LibraryViewSet, basename="library")

urlpatterns = router.urls
