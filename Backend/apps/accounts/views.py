"""
Vues d'authentification.

Le jeton d'accès est renvoyé dans le corps de la réponse ; le jeton de
renouvellement ne quitte jamais le cookie HttpOnly posé par le serveur.
"""

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import (
    REFRESH_COOKIE_NAME,
    CookieTokenRefreshSerializer,
    RegisterSerializer,
    UserSerializer,
)

# Le cookie n'est envoyé qu'aux routes d'authentification, et jamais depuis un autre site.
REFRESH_COOKIE = {"key": REFRESH_COOKIE_NAME, "path": "/api/auth/", "samesite": "Strict"}


class RefreshCookieMixin:
    """Déplace le jeton de renouvellement du corps de la réponse vers le cookie."""

    def finalize_response(self, request, response, *args, **kwargs):
        # Toute réponse ne contient pas de jeton : une requête OPTIONS, par exemple,
        # répond 200 en décrivant la route.
        refresh = response.data.pop("refresh", None) if isinstance(response.data, dict) else None
        if refresh:
            response.set_cookie(
                **REFRESH_COOKIE,
                value=refresh,
                max_age=jwt_settings.REFRESH_TOKEN_LIFETIME,
                httponly=True,
                secure=not settings.DEBUG,
            )
        return super().finalize_response(request, response, *args, **kwargs)


class RegisterView(generics.CreateAPIView):
    """Crée un compte client."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class LoginView(RefreshCookieMixin, TokenObtainPairView):
    """Connecte l'utilisateur : jeton d'accès dans la réponse, renouvellement en cookie."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RefreshView(RefreshCookieMixin, TokenRefreshView):
    """Émet un nouveau jeton d'accès et fait tourner le jeton de renouvellement."""

    serializer_class = CookieTokenRefreshSerializer


class LogoutView(APIView):
    """Révoque le jeton de renouvellement et supprime son cookie."""

    permission_classes = [AllowAny]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        try:
            RefreshToken(request.COOKIES.get(REFRESH_COOKIE_NAME)).blacklist()
        except TokenError:
            pass  # cookie absent, expiré ou déjà révoqué : rien à révoquer
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(**REFRESH_COOKIE)
        return response


class MeView(generics.RetrieveAPIView):
    """Profil de l'utilisateur connecté."""

    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
