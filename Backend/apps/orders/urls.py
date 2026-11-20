"""Routes des commandes, montées sous /api/."""

from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("orders", views.OrderViewSet, basename="order")

urlpatterns = router.urls
