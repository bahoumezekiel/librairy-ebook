# FasoLib – Backend (API)

API REST de la librairie numérique FasoLib : Django 6, Django REST Framework, PostgreSQL.
Ce guide explique comment la configurer avec **votre propre serveur PostgreSQL** et la démarrer en développement.

Les commandes sont écrites pour Windows (PowerShell), depuis le dossier `Backend`.

## 1. Ce qu'il faut avoir installé

| Outil | Rôle | Remarque |
|---|---|---|
| Python 3.13 ou plus | Fait tourner Django | Le projet est testé avec Python 3.15 |
| PostgreSQL 15 ou plus | Base de données | Le projet est testé avec PostgreSQL 17 |
| Docker Desktop | Lance Redis et le stockage de fichiers | Voir l'étape 5 |

PostgreSQL est obligatoire : la recherche du catalogue utilise la recherche plein texte de PostgreSQL. SQLite ne fonctionne pas.

## 2. Créer la base dans votre PostgreSQL

Ouvrez `psql` (ou pgAdmin) avec un compte administrateur, par exemple `postgres`, puis exécutez :

```sql
CREATE USER fasolib WITH PASSWORD 'choisissez-un-mot-de-passe' CREATEDB;
CREATE DATABASE fasolib OWNER fasolib;
```

Deux points comptent ici :

- **`OWNER fasolib`** : l'utilisateur doit être propriétaire de la base. La première migration installe l'extension `unaccent` (recherche sans accents) et crée une configuration de recherche ; seul le propriétaire en a le droit.
- **`CREATEDB`** : il sert uniquement à lancer les tests, qui créent une base temporaire `test_fasolib`. Vous pouvez l'omettre sur un serveur de production.

## 3. Installer les dépendances Python

```powershell
python -m venv env
.\env\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
```

`requirements-dev.txt` installe aussi les outils de test (`pytest`) et de style (`ruff`). En production, utilisez `requirements.txt`.

Si l'installation de `PyYAML` échoue avec Python 3.15 (pas encore de version précompilée), relancez-la ainsi :

```powershell
$env:PYYAML_FORCE_LIBYAML = "0"
python -m pip install -r requirements-dev.txt
```

## 4. Écrire le fichier `.env`

Le fichier `.env` se place **à la racine du projet** (le dossier qui contient `Backend` et `Frontend`). Copiez le modèle puis remplissez-le :

```powershell
Copy-Item ..\.env.example ..\.env
```

| Variable | Valeur à mettre |
|---|---|
| `DJANGO_SECRET_KEY` | Une clé aléatoire (commande ci-dessous) |
| `DJANGO_DEBUG` | `True` en développement, `False` en production |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` en développement |
| `POSTGRES_DB` | `fasolib` (la base créée à l'étape 2) |
| `POSTGRES_USER` | `fasolib` |
| `POSTGRES_PASSWORD` | Le mot de passe choisi à l'étape 2 |
| `POSTGRES_HOST` | `127.0.0.1` si PostgreSQL est sur cette machine |
| `POSTGRES_PORT` | `5432`, sauf si votre PostgreSQL écoute ailleurs |
| `REDIS_URL` | `redis://127.0.0.1:6379/0` |
| `CELERY_BROKER_URL` | `redis://127.0.0.1:6379/1` |
| `S3_ENDPOINT_URL` | `http://127.0.0.1:9000` |
| `S3_REGION` | `us-east-1` |
| `S3_PRIVATE_BUCKET` / `S3_PUBLIC_BUCKET` | `librairie-prive` / `librairie-public` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Un identifiant et un secret de votre choix |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` (le back-office en développement) |
| `FRONTEND_URL` | `http://localhost:5173` |
| `NUM_PROXIES` | `0` en développement, `1` derrière Nginx |
| `THROTTLE_AUTH`, `THROTTLE_ORDERS`, `THROTTLE_CONTACT`, `THROTTLE_NEWSLETTER`, `THROTTLE_PASSWORD_RESET` | **À ne pas renseigner.** Les débits de la limitation, dont les valeurs par défaut sont celles de production. Seule la pile jetable du test d'intrusion les desserre, pour que le scanner atteigne le code au lieu de se faire refouler |
| `GENIUSPAY_SIMULATION` | `True` pour tester les achats sans clés Genius Pay : le client choisit l'issue du paiement sur une page du site. À laisser sur `False` dès que vous avez des clés ; l'API refuse de démarrer si cette option est active avec `DJANGO_DEBUG=False` |
| `GENIUSPAY_API_SECRET` | Votre clé secrète Genius Pay (`sk_sandbox_…` en développement, `sk_live_…` en production). Visible dans **Paramètres → API** du tableau de bord Genius Pay. |
| `GENIUSPAY_API_KEY` | Votre clé publique (`pk_sandbox_…`). Facultative en sandbox : Genius Pay accepte la clé secrète seule, qui est alors utilisée à sa place. À renseigner en production. |
| `GENIUSPAY_WEBHOOK_SECRET` | Le secret (`whsec_…`) affiché par Genius Pay pour votre webhook. Sans lui, toutes les notifications de paiement sont refusées. En production (`DJANGO_DEBUG=False`), ce secret et `GENIUSPAY_API_SECRET` sont obligatoires : l'API refuse de démarrer sans eux, plutôt que d'accepter des notifications non signées. |

Pour générer la clé secrète Django :

```powershell
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

Entourez-la de guillemets simples dans `.env`, car elle peut contenir des caractères spéciaux : `DJANGO_SECRET_KEY='...'`.

Utilisez `127.0.0.1` plutôt que `localhost` : sous Windows, `localhost` ajoute environ 2 secondes à chaque connexion.

## 5. Démarrer Redis et le stockage de fichiers

L'API a besoin de deux services en plus de PostgreSQL :

- **Redis** : limitation des tentatives de connexion et file des tâches Celery ;
- **un stockage compatible S3** : couvertures et fichiers des livres.

Le fichier `docker-compose.yml` de la racine les fournit. Depuis la racine du projet, lancez **seulement ces deux services** :

```powershell
docker compose up -d redis s3
```

Ne lancez pas le service `db` : c'est un PostgreSQL de secours qui occuperait le même port 5432 que le vôtre.

## 6. Préparer la base et le stockage

Depuis le dossier `Backend`, environnement virtuel activé :

```powershell
python manage.py migrate
python manage.py setup_storage
python manage.py createsuperuser
```

- `migrate` crée les tables.
- `setup_storage` crée les deux espaces de stockage (privé pour les livres, public pour les couvertures).
- `createsuperuser` crée le compte administrateur : il demande un e-mail, un prénom, un nom et un mot de passe. C'est ce compte qui se connecte au back-office.

## 7. Démarrer l'API

```powershell
python manage.py runserver
```

L'API répond sur http://127.0.0.1:8000. La documentation interactive (Swagger) est sur http://127.0.0.1:8000/api/docs/.

Les tâches de fond (préparation des copies chiffrées, suivi des paiements) tournent dans deux autres terminaux :

```powershell
python -m celery -A config worker --pool=solo --loglevel=INFO
python -m celery -A config beat --loglevel=INFO
```

L'option `--pool=solo` est nécessaire sous Windows. Sans ces deux processus, l'API fonctionne, mais un livre acheté ne devient pas lisible et les paiements en attente ne sont pas relancés.

## 7 bis. Tester le paiement avec le sandbox Genius Pay

1. Dans `.env`, renseignez `GENIUSPAY_API_SECRET` (et `GENIUSPAY_WEBHOOK_SECRET`, voir le point 4) et mettez `GENIUSPAY_SIMULATION=False`. Ajoutez `.trycloudflare.com` à `DJANGO_ALLOWED_HOSTS` (développement uniquement).
2. Genius Pay confirme un paiement en appelant votre API. Votre ordinateur n'étant pas joignable depuis internet, ouvrez un tunnel public. Installation (une fois) : `winget install Cloudflare.cloudflared`. Puis, API démarrée :

   ```powershell
   & "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8000
   ```

   Une adresse `https://xxxx.trycloudflare.com` s'affiche. **Elle change à chaque lancement** et le tunnel s'arrête si vous fermez la fenêtre.
3. Dans le tableau de bord Genius Pay, rubrique Webhooks, déclarez `https://xxxx.trycloudflare.com/geniuspay/webhook/` en cochant les événements de paiement (réussi, échoué, annulé, expiré).
4. Copiez le secret `whsec_…` de ce webhook dans `GENIUSPAY_WEBHOOK_SECRET`, puis redémarrez l'API et le worker Celery.
5. Achetez un livre depuis le site (`http://localhost:5173`). Vous arrivez sur la page de paiement sandbox de Genius Pay : choisissez un scénario (réussi, échoué, délai dépassé, en attente), faites glisser ou cliquez pour simuler, puis cliquez sur **Terminer** pour revenir sur le site. Aucun argent n'est débité.

Statuts réellement renvoyés par Genius Pay : `pending`, `completed`, `failed`. Le scénario « délai dépassé » arrive comme `failed`.

**Le tunnel meurt sans prévenir.** Une adresse `trycloudflare.com` est temporaire : Cloudflare finit par retirer son enregistrement DNS, et le `cloudflared` qui tourne chez vous continue pourtant d'afficher la même adresse, sans message d'erreur. Genius Pay ne joint plus rien et ses notifications se perdent. Pour le vérifier à tout moment :

```powershell
Resolve-DnsName xxxx.trycloudflare.com
```

Si la réponse est « domaine inexistant », arrêtez `cloudflared`, relancez-le, et déclarez la nouvelle adresse dans le tableau de bord Genius Pay (point 3).

Une notification perdue ne bloque toutefois pas la commande : la page de suivi relit elle-même le paiement chez Genius Pay (au plus une fois toutes les 10 secondes), et la tâche `sync_pending_payments` repasse sur les paiements en attente toutes les 5 minutes. Encore faut-il que **Celery beat tourne** (point 7).

## 8. Vérifier que tout fonctionne

```powershell
python manage.py check
python -m pytest
python -m ruff check .
```

L'API répond aussi sur `http://127.0.0.1:8000/api/health/`, sans authentification :

```json
{"status": "ok"}
```

Cette adresse vérifie la base et le cache. Elle répond 503 avec le nom du service en panne,
et c'est elle que Docker interroge pour savoir si l'API va bien.

Les tests ont besoin de PostgreSQL, de Redis et du stockage en marche. Ils utilisent une base et des espaces de stockage temporaires : vos données ne sont pas touchées.

## Problèmes fréquents

| Message | Cause probable | Solution |
|---|---|---|
| `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xe9` au lancement de `migrate` ou de `runserver` | PostgreSQL a refusé la connexion et son message d'erreur, en français, contient un accent que le pilote ne sait pas lire. Le plus souvent : utilisateur inexistant, mauvais mot de passe ou base inexistante | Retrouvez le vrai message avec `psql -h 127.0.0.1 -p VOTRE_PORT -U fasolib -d fasolib`, puis corrigez `.env` ou refaites l'étape 2 |
| `permission denied to create extension "unaccent"` | L'utilisateur n'est pas propriétaire de la base, ou PostgreSQL est antérieur à la version 13 | Refaites l'étape 2 avec `OWNER fasolib`, ou exécutez `CREATE EXTENSION unaccent;` dans la base avec le compte `postgres` |
| `permission denied to create database` pendant les tests | L'utilisateur n'a pas le droit `CREATEDB` | `ALTER USER fasolib CREATEDB;` |
| `password authentication failed` | Mot de passe ou utilisateur différent entre PostgreSQL et `.env` | Corrigez `POSTGRES_USER` et `POSTGRES_PASSWORD` |
| `connection refused` sur le port 5432 | PostgreSQL arrêté, ou autre port | Démarrez le service PostgreSQL, vérifiez `POSTGRES_PORT` |
| `Error 10061 connecting to 127.0.0.1:6379` | Redis arrêté | `docker compose up -d redis s3` |
| Erreur à l'envoi d'une couverture ou d'un livre | Stockage arrêté ou espaces non créés | `docker compose up -d redis s3`, puis `python manage.py setup_storage` |
| `UndefinedValueError: ... not found` | Variable absente du fichier `.env` | Comparez votre `.env` avec `.env.example` |
| `ImproperlyConfigured: Clés Genius Pay manquantes` | `DJANGO_DEBUG=False` sans clés de paiement | Renseignez `GENIUSPAY_API_SECRET` et `GENIUSPAY_WEBHOOK_SECRET`, ou repassez en `DJANGO_DEBUG=True` pour développer |
| La page « Confirmation du paiement… » tourne sans fin | La notification de Genius Pay n'arrive pas : adresse du tunnel périmée, ou webhook mal déclaré | Vérifiez l'adresse du tunnel (point 7 bis) ; la commande se confirme malgré tout dans les 10 secondes si l'API tourne, et dans les 5 minutes si Celery beat tourne |

## Organisation du code

```
Backend/
├─ config/        réglages, routes racine, Celery, format d'erreur unique
├─ apps/
│  ├─ accounts/   utilisateurs, connexion par jetons JWT
│  ├─ catalog/    catégories, livres, recherche, notes, nouveautés
│  ├─ orders/     commandes, paiement Genius Pay, statistiques du tableau de bord
│  ├─ library/    achats, copies chiffrées, licences d'appareil
│  └─ contact/    messages du formulaire de contact, abonnés à la newsletter
└─ tests/         tests automatisés (pytest)
```

Dans chaque app, les fichiers préfixés `admin_` (`admin_views.py`, `admin_urls.py`…) contiennent les routes `/api/admin/…` réservées à l'administrateur.

## Mise en production

La marche à suivre est dans le **[README du projet](../README.md#5-déployer-avec-dokploy-pas-à-pas)** :
tout tourne dans des conteneurs Docker, déployés par Dokploy. Ce qui vient ensuite —
sauvegardes, surveillance, dépannage — est dans **[docs/EXPLOITATION.md](../docs/EXPLOITATION.md)**.

Ce qu'il faut retenir ici :

- `DJANGO_DEBUG=False` impose le HTTPS, ferme la documentation de l'API et exige les clés
  Genius Pay. Vérifiez la configuration avec `python manage.py check --deploy`.
- Les livres sont acceptés jusqu'à 100 Mo : tout serveur web placé devant Django doit le
  permettre (`client_max_body_size 110m;` est déjà posé dans `deploy/nginx/common.conf`).
- Prévoyez au moins 1 Go de mémoire pour le worker Celery : la préparation d'un livre acheté
  charge le fichier, son filigrane et sa version chiffrée en mémoire.
- Ne versionnez jamais le fichier `.env`.
