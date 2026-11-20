"""Vues du back-office : consultation des clients, réservée à l'administrateur."""

from rest_framework import generics
from rest_framework.permissions import IsAdminUser

from .models import User
from .serializers import ClientSerializer


class AdminClientListView(generics.ListAPIView):
    """Liste des clients, du plus récent au plus ancien."""

    queryset = User.objects.filter(is_staff=False).order_by("-created_at")
    serializer_class = ClientSerializer
    permission_classes = [IsAdminUser]
