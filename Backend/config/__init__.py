"""Charge l'application Celery avec Django, pour que les tâches s'y rattachent."""

from .celery import app as celery_app

__all__ = ["celery_app"]
