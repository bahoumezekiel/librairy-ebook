"""
Format d'erreur unique de l'API.

Toute erreur renvoie `{"code": ..., "message": ...}`. Les erreurs de validation
ajoutent `errors`, le détail par champ, pour l'affichage dans les formulaires.
"""

from django.http import JsonResponse
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.views import exception_handler


class Conflict(APIException):
    """L'action est refusée car elle contredit l'état actuel des données."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "Cette action est impossible dans l'état actuel des données."
    default_code = "conflict"


def api_exception_handler(exc, context):
    """Convertit les erreurs levées dans une vue DRF au format unique."""
    response = exception_handler(exc, context)
    if response is None:
        # Erreur inattendue : Django la journalise et répond via `server_error`.
        return None

    if isinstance(exc, ValidationError):
        response.data = {
            "code": "validation_error",
            "message": "Les données envoyées sont invalides.",
            "errors": response.data,
        }
    else:
        # DRF range `detail` sous la clé « detail », sauf quand l'exception porte une liste
        # ou un dictionnaire : la réponse garde alors sa forme. Le format de l'API reste
        # le même dans tous les cas, plutôt que de laisser passer une erreur 500.
        detail = response.data.get("detail") if isinstance(response.data, dict) else None
        if detail is None:
            detail = "Cette requête n'a pas pu être traitée."
        response.data = {"code": getattr(detail, "code", "error"), "message": str(detail)}
    return response


def not_found(request, exception):
    """Réponse 404 pour une URL qui ne correspond à aucune route."""
    return JsonResponse({"code": "not_found", "message": "Ressource introuvable."}, status=404)


def server_error(request):
    """Réponse 500 pour une erreur non gérée."""
    return JsonResponse(
        {"code": "server_error", "message": "Erreur interne du serveur."}, status=500
    )
