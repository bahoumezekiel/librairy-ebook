"""Sérialiseurs du formulaire de contact et de la newsletter."""

from rest_framework import serializers

from .models import ContactMessage, NewsletterSubscriber

MAX_MESSAGE_LENGTH = 5000


class ContactMessageSerializer(serializers.ModelSerializer):
    message = serializers.CharField(max_length=MAX_MESSAGE_LENGTH)

    class Meta:
        model = ContactMessage
        fields = ["id", "name", "email", "subject", "message", "created_at"]
        read_only_fields = ["created_at"]


class NewsletterSubscriberSerializer(serializers.ModelSerializer):
    # Champ déclaré sans contrôle d'unicité : une réinscription est acceptée sans erreur.
    email = serializers.EmailField()

    class Meta:
        model = NewsletterSubscriber
        fields = ["id", "email", "subscribed_at"]
        read_only_fields = ["subscribed_at"]
