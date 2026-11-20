"""Modèle utilisateur : connexion par e-mail, rôle administrateur porté par `is_staff`."""

import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Crée et retrouve les utilisateurs par e-mail, toujours en minuscules."""

    def create_user(self, email, password, **extra_fields):
        user = self.model(email=email.lower(), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra_fields):
        return self.create_user(email, password, is_staff=True, **extra_fields)

    def get_by_natural_key(self, email):
        return super().get_by_natural_key(email.lower())


class User(AbstractBaseUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    # Les livres publiés après cette date sont des nouveautés non lues pour l'utilisateur.
    notifications_read_at = models.DateTimeField(default=timezone.now)

    last_login = None  # champ hérité non utilisé

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    def __str__(self):
        return self.email
