"""
Sérialiseurs des comptes.

Profil, inscription, renouvellement par cookie et réinitialisation du mot de passe.
"""

from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers, status
from rest_framework.exceptions import APIException
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from .models import User
from .tasks import send_password_reset_email

REFRESH_COOKIE_NAME = "refresh_token"

# Longueur bornée : un mot de passe démesuré ne doit pas occuper le serveur au hachage.
MAX_PASSWORD_LENGTH = 128


def password_field():
    """Champ de mot de passe commun à l'inscription et à la réinitialisation."""
    return serializers.CharField(
        write_only=True, max_length=MAX_PASSWORD_LENGTH, style={"input_type": "password"}
    )


def check_password_for(password, user):
    """Applique les règles de Django, en comparant le mot de passe au titulaire du compte."""
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({"password": exc.messages}) from exc


class InvalidResetLink(APIException):
    """Lien de réinitialisation inconnu, déjà utilisé ou périmé."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "invalid_reset_link"
    default_detail = "Ce lien n'est plus valable. Demandez-en un nouveau."


class UserSerializer(serializers.ModelSerializer):
    """Profil public d'un utilisateur. `is_staff` n'est jamais modifiable par l'API."""

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "is_staff"]
        read_only_fields = ["is_staff"]


class ClientSerializer(serializers.ModelSerializer):
    """Client tel que le voit l'administrateur dans le back-office."""

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "created_at"]


class RegisterSerializer(UserSerializer):
    """Création d'un compte client."""

    email = serializers.EmailField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                lookup="iexact",
                message="Un compte existe déjà avec cette adresse e-mail.",
            )
        ]
    )
    password = password_field()

    class Meta(UserSerializer.Meta):
        fields = [*UserSerializer.Meta.fields, "password"]

    def validate(self, attrs):
        # L'utilisateur provisoire sert au contrôle de ressemblance avec l'e-mail et le nom.
        check_password_for(attrs["password"], User(**attrs))
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class CookieTokenRefreshSerializer(TokenRefreshSerializer):
    """Lit le jeton de renouvellement dans le cookie HttpOnly, jamais dans le corps."""

    refresh = None

    def validate(self, attrs):
        refresh = self.context["request"].COOKIES.get(REFRESH_COOKIE_NAME)
        if not refresh:
            raise InvalidToken("Jeton de renouvellement absent.")
        return super().validate({"refresh": refresh})


class PasswordResetSerializer(serializers.Serializer):
    """Demande d'un lien de réinitialisation, à partir de la seule adresse e-mail."""

    email = serializers.EmailField()

    def save(self):
        """
        Envoie le lien si un compte correspond, et reste muet sinon.

        La réponse est identique dans les deux cas : la route ne doit pas révéler
        quelles adresses sont inscrites sur la plateforme.
        """
        user = User.objects.filter(email__iexact=self.validated_data["email"]).first()
        if user is not None:
            send_password_reset_email.delay(user.pk)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Nouveau mot de passe, autorisé par le lien reçu par e-mail."""

    uid = serializers.CharField()
    token = serializers.CharField()
    password = password_field()

    def validate(self, attrs):
        # Le lien est contrôlé avant le mot de passe : sur un lien périmé, il serait
        # absurde de reprocher au client la qualité du mot de passe qu'il propose.
        user = self._user_from_uid(attrs["uid"])
        if user is None or not default_token_generator.check_token(user, attrs["token"]):
            raise InvalidResetLink
        check_password_for(attrs["password"], user)
        self.user = user
        return attrs

    @staticmethod
    def _user_from_uid(uid):
        """Compte désigné par l'identifiant encodé, ou None si celui-ci est inexploitable."""
        try:
            return User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
        except (User.DoesNotExist, DjangoValidationError, ValueError, TypeError):
            return None

    def save(self):
        """Enregistre le nouveau mot de passe, ce qui périme du même coup le lien utilisé."""
        self.user.set_password(self.validated_data["password"])
        self.user.save(update_fields=["password"])
        return self.user
