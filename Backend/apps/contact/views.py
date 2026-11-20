"""Formulaire de contact et newsletter : envoi par les visiteurs, gestion par l'administrateur."""

from rest_framework import generics, mixins, status, viewsets
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import ContactMessage, NewsletterSubscriber
from .serializers import ContactMessageSerializer, NewsletterSubscriberSerializer


class PublicFormMixin:
    """Formulaire ouvert à tous, limité par adresse IP contre les abus (un quota par formulaire)."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]


class ContactMessageCreateView(PublicFormMixin, generics.CreateAPIView):
    """Envoi d'un message depuis le formulaire de contact."""

    serializer_class = ContactMessageSerializer
    throttle_scope = "contact"


class NewsletterSubscribeView(PublicFormMixin, generics.CreateAPIView):
    """
    Inscription à la newsletter.

    Une adresse déjà inscrite reçoit la même réponse qu'une nouvelle : la réponse
    ne révèle jamais si une adresse figure déjà dans la liste.
    """

    serializer_class = NewsletterSubscriberSerializer
    throttle_scope = "newsletter"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        NewsletterSubscriber.objects.get_or_create(email=email)
        return Response({"email": email}, status=status.HTTP_201_CREATED)


class AdminListDestroyViewSet(
    mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """Consultation et suppression, réservées à l'administrateur."""

    permission_classes = [IsAdminUser]


class AdminContactMessageViewSet(AdminListDestroyViewSet):
    """Messages reçus, du plus récent au plus ancien."""

    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer


class AdminNewsletterSubscriberViewSet(AdminListDestroyViewSet):
    """Abonnés à la newsletter, du plus récent au plus ancien."""

    queryset = NewsletterSubscriber.objects.all()
    serializer_class = NewsletterSubscriberSerializer
