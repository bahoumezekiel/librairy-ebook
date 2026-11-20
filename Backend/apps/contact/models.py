"""Relation avec les visiteurs : messages du formulaire de contact et abonnés à la newsletter."""

from django.db import models


class ContactMessage(models.Model):
    name = models.CharField(max_length=150)
    email = models.EmailField()
    subject = models.CharField(max_length=150)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.subject} ({self.email})"


class NewsletterSubscriber(models.Model):
    """Adresse inscrite à la newsletter ; une adresse n'est enregistrée qu'une fois."""

    email = models.EmailField(unique=True)
    subscribed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-subscribed_at", "-id"]

    def __str__(self):
        return self.email
