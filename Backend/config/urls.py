"""Routes racine de l'API."""

from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.orders.simulation import SimulatedPaymentView

from .health import health

urlpatterns = [
    # Contrôle de santé du conteneur : avant les routes d'applications, car il doit répondre
    # même quand une dépendance est en panne.
    path("api/health/", health, name="health"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/admin/", include("apps.accounts.admin_urls")),
    path("api/admin/", include("apps.catalog.admin_urls")),
    path("api/admin/", include("apps.orders.admin_urls")),
    path("api/admin/", include("apps.contact.admin_urls")),
    path("api/", include("apps.catalog.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/", include("apps.library.urls")),
    path("api/", include("apps.contact.urls")),
    # Issue d'un paiement simulé : la vue répond 404 si la simulation est désactivée.
    path(
        "api/simulation/payments/<str:reference>/",
        SimulatedPaymentView.as_view(),
        name="simulated-payment",
    ),
    # Notifications de paiement : vue du SDK, signature vérifiée (/geniuspay/webhook/).
    path("geniuspay/", include("geniuspay.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

handler404 = "config.exceptions.not_found"
handler500 = "config.exceptions.server_error"
