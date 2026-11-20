"""Routes publiques du contact et de la newsletter, montées sous /api/."""

from django.urls import path

from . import views

urlpatterns = [
    path("contact/", views.ContactMessageCreateView.as_view(), name="contact"),
    path("newsletter/", views.NewsletterSubscribeView.as_view(), name="newsletter"),
]
