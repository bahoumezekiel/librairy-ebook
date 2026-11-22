"""
Réglages Django de la librairie numérique.

Toute valeur sensible ou propre à un environnement est lue dans les variables
d'environnement (fichier `.env` à la racine du dépôt, voir `.env.example`).
"""

from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

from decouple import Csv, config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Sécurité ---------------------------------------------------------------

SECRET_KEY = config("DJANGO_SECRET_KEY")
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="", cast=Csv())

# Adresse publique de la plateforme, site et API confondus. Elle sert au retour de Genius
# Pay, aux liens de réinitialisation du mot de passe, et aux URL des couvertures.
FRONTEND_URL = config("FRONTEND_URL")

if not DEBUG:
    # En production, Nginx termine le HTTPS et transmet le schéma d'origine.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31_536_000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # Pas de `preload` : cette mention engage le domaine entier, que la plateforme peut
    # partager avec d'autres sites. L'annoncer forcerait le HTTPS sur tous les
    # sous-domaines de son propriétaire, ce que ce projet n'a pas à décider pour lui.

# Pas de middleware CSRF : l'API s'authentifie par jeton dans l'en-tête Authorization,
# et le seul cookie (renouvellement) est en SameSite=Strict, donc jamais envoyé par un autre site.
SILENCED_SYSTEM_CHECKS = [
    "security.W003",
    # W021 réclame `SECURE_HSTS_PRELOAD` : voir la raison plus haut.
    "security.W021",
]

# Seul le site React peut appeler l'API depuis un navigateur, cookie compris.
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", default="", cast=Csv())
CORS_ALLOW_CREDENTIALS = True

# --- Applications -----------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.postgres",
    "corsheaders",
    "django_filters",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "geniuspay",
    "apps.accounts",
    "apps.catalog",
    "apps.orders",
    "apps.library",
    "apps.contact",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Seule la page Swagger (/api/docs/) utilise un gabarit HTML.
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
    },
]

# --- Base de données --------------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB"),
        "USER": config("POSTGRES_USER"),
        "PASSWORD": config("POSTGRES_PASSWORD"),
        "HOST": config("POSTGRES_HOST", default="localhost"),
        "PORT": config("POSTGRES_PORT", default=5434, cast=int),
    }
}

# Cache partagé entre les processus : compteurs de limitation des tentatives.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": config("REDIS_URL"),
    }
}

# --- Stockage des fichiers ----------------------------------------------------

_S3_OPTIONS = {
    "endpoint_url": config("S3_ENDPOINT_URL"),
    "region_name": config("S3_REGION"),
    "access_key": config("S3_ACCESS_KEY"),
    "secret_key": config("S3_SECRET_KEY"),
    "addressing_style": "path",
    "signature_version": "s3v4",
    "default_acl": None,
    "file_overwrite": False,
}

# Chemin sous lequel Nginx relaie le stockage public (deploy/nginx/common.conf). C'est
# aussi le nom du compartiment : l'adresse d'une couverture est alors la même des deux
# côtés du relais, et rien n'a à être réécrit en chemin.
_MEDIA_PATH = "media"

_S3_PUBLIC_OPTIONS = {
    **_S3_OPTIONS,
    "bucket_name": config("S3_PUBLIC_BUCKET"),
    "querystring_auth": False,
}

# Hors développement, le stockage objet n'est joignable que depuis le réseau privé de la
# composition : aucun navigateur ne peut l'atteindre. Les couvertures passent donc par
# Nginx, sous le domaine du site. En développement, le navigateur y accède directement.
if not DEBUG:
    if _S3_PUBLIC_OPTIONS["bucket_name"] != _MEDIA_PATH:
        raise ImproperlyConfigured(
            f"S3_PUBLIC_BUCKET doit valoir « {_MEDIA_PATH} » : c'est le chemin sous lequel "
            "Nginx sert les couvertures. Un autre nom les ferait toutes disparaître."
        )
    _site = urlparse(FRONTEND_URL)
    if not _site.netloc:
        raise ImproperlyConfigured(
            "FRONTEND_URL doit être une adresse complète, schéma compris : https://exemple.com"
        )
    _S3_PUBLIC_OPTIONS["url_protocol"] = f"{_site.scheme}:"
    _S3_PUBLIC_OPTIONS["custom_domain"] = f"{_site.netloc}/{_MEDIA_PATH}"

# Privé par défaut : seul ce qui est rangé explicitement dans « public » est exposé.
STORAGES = {
    # Livres : aucune adresse publique. L'API les transmet elle-même, après avoir vérifié
    # le droit d'y accéder. Une URL signée qui serait produite malgré tout — par un script
    # d'administration, par exemple — n'aurait que cinq minutes de validité.
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            **_S3_OPTIONS,
            "bucket_name": config("S3_PRIVATE_BUCKET"),
            "querystring_expire": 300,
        },
    },
    # Couvertures : lisibles par tous, URL stables et sans signature.
    "public": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": _S3_PUBLIC_OPTIONS,
    },
}

# --- Comptes et mots de passe -----------------------------------------------

AUTH_USER_MODEL = "accounts.User"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.Argon2PasswordHasher"]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": f"django.contrib.auth.password_validation.{name}"}
    for name in (
        "UserAttributeSimilarityValidator",
        "MinimumLengthValidator",
        "CommonPasswordValidator",
        "NumericPasswordValidator",
    )
]

# Validité du lien de réinitialisation du mot de passe : une heure. Le jeton devient
# aussi inutilisable dès que le mot de passe change, donc un lien ne sert qu'une fois.
PASSWORD_RESET_TIMEOUT = 60 * 60

# --- Envoi d'e-mails --------------------------------------------------------

# Django 6.1 remplace les réglages EMAIL_* par MAILERS ; les deux ne peuvent coexister,
# d'où la lecture des variables d'environnement dans des noms privés.
_EMAIL_HOST = config("EMAIL_HOST", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="FasoLib <ne-pas-repondre@fasolib.local>")

if _EMAIL_HOST:
    _MAILER = {
        "BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        "OPTIONS": {
            "host": _EMAIL_HOST,
            "port": config("EMAIL_PORT", default=587, cast=int),
            "username": config("EMAIL_HOST_USER", default=""),
            "password": config("EMAIL_HOST_PASSWORD", default=""),
            "use_tls": config("EMAIL_USE_TLS", default=True, cast=bool),
        },
    }
else:
    # Sans fournisseur configuré, les messages s'affichent dans la console : pratique en
    # développement, inacceptable en production, d'où le contrôle ci-dessous.
    _MAILER = {"BACKEND": "django.core.mail.backends.console.EmailBackend"}

MAILERS = {"default": _MAILER}

# Un client qui ne reçoit pas son lien ne peut plus se connecter du tout : mieux vaut
# refuser de démarrer que de laisser les messages partir dans le vide.
if not DEBUG and not _EMAIL_HOST:
    raise ImproperlyConfigured("EMAIL_HOST est obligatoire en production.")

# --- Internationalisation ---------------------------------------------------

LANGUAGE_CODE = "fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# --- API REST ---------------------------------------------------------------

REST_FRAMEWORK = {
    # Fermé par défaut : chaque route publique déclare explicitement AllowAny.
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    # « auth » : inscription et connexion, par adresse IP.
    # « orders » : création de commande, par client.
    # « contact » et « newsletter » : formulaires publics, par adresse IP.
    # « password_reset » : demande de lien, par adresse IP. Serré, car chaque appel
    # envoie un e-mail à un tiers : la route ne doit pas servir à le harceler.
    #
    # Les valeurs par défaut sont celles de la production : les laisser telles quelles.
    # Elles ne sont réglables que pour la pile jetable du test d'intrusion, où un scanner
    # actif se ferait sinon refouler dès sa dixième requête — il ne mesurerait plus que
    # notre limitation, prendrait la différence de réponse pour une faille, et surtout
    # n'atteindrait plus le code à éprouver. La limitation, elle, est vérifiée par les
    # tests et par la passe « site » du pipeline, à travers Nginx.
    "DEFAULT_THROTTLE_RATES": {
        "auth": config("THROTTLE_AUTH", default="10/minute"),
        "orders": config("THROTTLE_ORDERS", default="10/minute"),
        "contact": config("THROTTLE_CONTACT", default="5/hour"),
        "newsletter": config("THROTTLE_NEWSLETTER", default="5/hour"),
        "password_reset": config("THROTTLE_PASSWORD_RESET", default="5/hour"),
    },
    # Nombre de proxys (Nginx) devant Django, pour lire la vraie adresse IP du client.
    "NUM_PROXIES": config("NUM_PROXIES", default=0, cast=int),
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "config.exceptions.api_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    # Chaque renouvellement émet un nouveau jeton : la session se prolonge tant qu'on l'utilise.
    "ROTATE_REFRESH_TOKENS": True,
    # L'ancien jeton n'est pas révoqué à ce moment-là : si le navigateur interrompt la requête
    # (double rechargement de la page), il le détient encore et serait déconnecté à tort.
    # La révocation a lieu à la déconnexion.
    "BLACKLIST_AFTER_ROTATION": False,
}

# --- Paiement ---------------------------------------------------------------

# Devise unique de la plateforme : tous les prix sont en francs CFA.
CURRENCY = "XOF"

# Paiement simulé (apps/orders/simulation.py) : pour développer sans clés Genius Pay.
# Il accorderait des livres sans paiement réel, donc il est interdit hors mode DEBUG.
GENIUSPAY_SIMULATION = config("GENIUSPAY_SIMULATION", default=False, cast=bool)
if GENIUSPAY_SIMULATION and not DEBUG:
    raise ImproperlyConfigured("GENIUSPAY_SIMULATION ne peut être activé que si DJANGO_DEBUG=True.")

# Clés lues par le SDK Genius Pay (clés sandbox en développement).
_GENIUSPAY_SECRET = config("GENIUSPAY_API_SECRET", default="")
_GENIUSPAY_WEBHOOK_SECRET = config("GENIUSPAY_WEBHOOK_SECRET", default="")
GENIUSPAY = {
    # Genius Pay accepte la clé secrète seule en sandbox (vérifié) ; le SDK exige pourtant les
    # deux valeurs. À défaut de clé publique (pk_…), la clé secrète est donc utilisée pour les deux.
    "API_KEY": config("GENIUSPAY_API_KEY", default="") or _GENIUSPAY_SECRET,
    "API_SECRET": _GENIUSPAY_SECRET,
    "WEBHOOK_SECRET": _GENIUSPAY_WEBHOOK_SECRET,
}

# En production, un secret de notification absent ferait accepter des notifications non signées.
# Un accès à un livre n'est jamais accordé sur cette seule foi (le paiement est toujours relu
# auprès du prestataire), mais une telle configuration doit échouer au démarrage, pas en silence.
if not DEBUG and not GENIUSPAY_SIMULATION:
    _missing = [
        name
        for name, value in (
            ("GENIUSPAY_API_SECRET", _GENIUSPAY_SECRET),
            ("GENIUSPAY_WEBHOOK_SECRET", _GENIUSPAY_WEBHOOK_SECRET),
        )
        if not value
    ]
    if _missing:
        raise ImproperlyConfigured(f"Clés Genius Pay manquantes : {', '.join(_missing)}.")

# --- Lecture hors ligne -----------------------------------------------------

# Durée de validité d'une licence d'appareil, renouvelée à chaque reconnexion.
OFFLINE_LICENSE_DAYS = 30
# Nombre d'appareils pouvant lire un même achat en même temps.
MAX_DEVICES_PER_PURCHASE = 3

# --- Tâches asynchrones (Celery) --------------------------------------------

CELERY_BROKER_URL = config("CELERY_BROKER_URL")
CELERY_TIMEZONE = TIME_ZONE
# Une connexion Redis inactive peut être coupée sans prévenir (pare-feu, Docker) : le worker
# attendrait des minutes avant de recevoir une tâche. D'où le maintien actif et la vérification.
CELERY_BROKER_TRANSPORT_OPTIONS = {"socket_keepalive": True, "health_check_interval": 25}
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BEAT_SCHEDULE = {
    # Rattrape les notifications de paiement perdues.
    "sync-pending-payments": {
        "task": "apps.orders.tasks.sync_pending_payments",
        "schedule": timedelta(minutes=5),
    },
}

# --- Journalisation ---------------------------------------------------------

# Tout va sur la sortie standard, y compris le suivi des paiements (niveau INFO).
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "{asctime} {levelname} {name} : {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}

# --- Documentation de l'API -------------------------------------------------

SPECTACULAR_SETTINGS = {
    "TITLE": "Librairie numérique – API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # La documentation détaille toutes les routes : publique en développement, réservée
    # à l'administrateur en production.
    "SERVE_PERMISSIONS": [
        "rest_framework.permissions.AllowAny" if DEBUG else "rest_framework.permissions.IsAdminUser"
    ],
}
