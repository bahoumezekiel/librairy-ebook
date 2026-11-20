"""
État de santé de l'API, interrogé par Docker et par Nginx.

Sans authentification, car c'est le point d'entrée du superviseur : la réponse ne
contient donc qu'un verdict et le nom du service en panne, jamais de détail interne.
"""

import logging

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET

logger = logging.getLogger(__name__)

CACHE_KEY = "health"


def _check_database():
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")


def _check_cache():
    cache.set(CACHE_KEY, "ok", 10)
    if cache.get(CACHE_KEY) != "ok":
        raise RuntimeError("valeur non relue")


@require_GET
def health(request):
    """Répond 200 si la base et le cache répondent, 503 sinon."""
    broken = []
    for name, check in (("database", _check_database), ("cache", _check_cache)):
        try:
            check()
        except Exception:  # noqa: BLE001 - toute panne du service doit donner un 503
            logger.exception("Contrôle de santé « %s » en échec", name)
            broken.append(name)

    if broken:
        return JsonResponse({"status": "unhealthy", "services": broken}, status=503)
    return JsonResponse({"status": "ok"})
