"""Sérialiseurs des comptes : profil, inscription et renouvellement par cookie."""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from .models import User

REFRESH_COOKIE_NAME = "refresh_token"


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
    # Longueur bornée : un mot de passe démesuré ne doit pas occuper le serveur au hachage.
    password = serializers.CharField(
        write_only=True, max_length=128, style={"input_type": "password"}
    )

    class Meta(UserSerializer.Meta):
        fields = [*UserSerializer.Meta.fields, "password"]

    def validate(self, attrs):
        # L'utilisateur provisoire sert au contrôle de ressemblance avec l'e-mail et le nom.
        try:
            validate_password(attrs["password"], User(**attrs))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
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
