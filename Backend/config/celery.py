"""Application Celery : tâches asynchrones et périodiques du projet."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("librairie")
# Les réglages Celery sont les variables CELERY_* de settings.py.
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
