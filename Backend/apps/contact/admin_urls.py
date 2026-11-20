"""Routes du back-office pour les messages et la newsletter, montées sous /api/admin/."""

from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("messages", views.AdminContactMessageViewSet, basename="admin-message")
router.register("subscribers", views.AdminNewsletterSubscriberViewSet, basename="admin-subscriber")

urlpatterns = router.urls
