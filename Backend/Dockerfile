# Image de l'API FasoLib : Django servi par Gunicorn.
# La même image fait tourner l'API, le worker Celery et Celery beat : seule la commande change.

FROM python:3.15-slim AS base

# PYTHONUNBUFFERED : les journaux partent tout de suite vers la sortie standard, donc vers Docker.
# PIP_NO_CACHE_DIR : rien à garder, l'image n'installera plus rien ensuite.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# libpq5 pour PostgreSQL ; curl pour le contrôle de santé du conteneur.
RUN apt-get update \
    && apt-get install --no-install-recommends --yes libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Les dépendances sont installées avant le code : une modification du code ne les réinstalle pas.
COPY requirements.txt .
RUN pip install --requirement requirements.txt

COPY . .

# L'API ne tourne pas en root : une faille dans une dépendance n'aurait pas les pleins pouvoirs.
RUN useradd --create-home --shell /usr/sbin/nologin fasolib && chown -R fasolib:fasolib /app
USER fasolib

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:8000/api/health/ || exit 1

# Fils d'exécution plutôt que processus : l'envoi d'un livre chiffré (jusqu'à 100 Mo) occupe
# un fil en attente du réseau, pas le processeur. Le délai est allongé d'autant.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--worker-class", "gthread", \
     "--threads", "4", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
