# FasoLib

Librairie numérique burkinabè : un catalogue de livres techniques, achetés en ligne par
mobile money, puis lus dans un lecteur intégré — y compris sans connexion.

Le projet tient en deux parties : une **API REST** en Django, et un **site React** qui
contient à la fois l'espace public et le back-office de l'administrateur.

---

## Sommaire

1. [Ce que fait la plateforme](#1-ce-que-fait-la-plateforme)
2. [Comment elle est construite](#2-comment-elle-est-construite)
3. [Organisation du dépôt](#3-organisation-du-dépôt)
4. [Démarrer en développement](#4-démarrer-en-développement)
5. [Déployer avec Dokploy, pas à pas](#5-déployer-avec-dokploy-pas-à-pas)
6. [Après la mise en ligne](#6-après-la-mise-en-ligne)
7. [Qualité du code](#7-qualité-du-code)

---

## 1. Ce que fait la plateforme

### Pour le visiteur

| | |
|---|---|
| **Catalogue** | Recherche en français (accents ignorés), filtres par catégorie, gratuit ou payant, tri par note ou par prix |
| **Livres gratuits** | Téléchargement direct, sans même créer de compte |
| **Livres payants** | Achat par mobile money via Genius Pay, puis lecture dans le lecteur intégré |
| **Lecture hors ligne** | Le livre acheté est enregistré chiffré sur l'appareil et s'ouvre sans réseau |
| **Notes** | Une note de 1 à 5 étoiles par livre acheté |
| **Nouveautés** | Une cloche annonce les livres publiés récemment |

### Pour l'administrateur

Tableau de bord (chiffre d'affaires, commandes, conversion, nouveaux clients, comparés à la
période précédente), gestion des livres et des catégories, suivi des commandes et des
paiements, liste des clients, messages du formulaire de contact, abonnés à la newsletter.

### Ce qui protège les livres payants

Un livre acheté l'est **à vie** : l'achat n'a pas de date de fin. En revanche le fichier ne
se télécharge jamais tel quel.

1. À l'achat, le serveur fabrique un **exemplaire personnel** : chaque page d'un PDF porte
   le nom et l'adresse de l'acheteur.
2. Cet exemplaire est **chiffré en AES-256-GCM**, avec une clé qui lui est propre.
3. Le navigateur le range dans IndexedDB avec sa clé, rendue **non exportable** : aucun
   script ne peut en lire la valeur.
4. Le texte en clair n'existe qu'en mémoire, le temps de la lecture.
5. Un même achat se lit sur **3 appareils** au plus ; une place se libère quand un appareil
   reste un mois sans ouvrir le livre.

Côté lecteur : pas de bouton de téléchargement, menu contextuel et impression désactivés,
texte non sélectionnable, filigrane nominatif.

---

## 2. Comment elle est construite

```
                    ┌──────────────────────────────┐
   Navigateur ─────▶│  Nginx  (service « web »)    │   un seul domaine,
                    │  • sert le site React        │   un seul cookie de session
                    │  • transmet /api à Django    │
                    └───────────┬──────────────────┘
                                │
                    ┌───────────▼──────────────────┐
                    │  Django + DRF  (« api »)     │
                    │  Gunicorn, 2 × 4 fils        │
                    └──┬────────┬────────┬─────────┘
                       │        │        │
              ┌────────▼──┐ ┌───▼────┐ ┌─▼─────────────┐
              │PostgreSQL │ │ Redis  │ │ Stockage S3   │
              │  données  │ │ cache  │ │ livres,       │
              │           │ │ + file │ │ couvertures   │
              └───────────┘ └───▲────┘ └─▲─────────────┘
                                │        │
                    ┌───────────┴────────┴─────────┐
                    │  Celery « worker » + « beat »│
                    │  • prépare les exemplaires   │
                    │  • rattrape les paiements    │
                    └──────────────────────────────┘
```

**Le site et l'API partagent un seul nom de domaine.** Ce n'est pas un détail de confort :
la session repose sur un cookie `SameSite=Strict`, qui n'est jamais envoyé vers un autre
site. C'est Nginx qui réunit les deux sous la même adresse.

### Les techniques retenues

| Partie | Outils |
|---|---|
| API | Django 6, Django REST Framework, PostgreSQL 17, Redis, Celery |
| Authentification | Jetons JWT ; le jeton de renouvellement reste dans un cookie `HttpOnly` |
| Paiement | Genius Pay, notification signée en HMAC-SHA256 |
| Fichiers | Stockage objet compatible S3 ; livres privés, couvertures publiques |
| Site | React 19, TypeScript, Vite, Tailwind, TanStack Query, Motion |
| Lecteur | PDF.js et epub.js, déchiffrement par l'API Web Crypto |
| Hors ligne | Service worker, IndexedDB |

### Un paiement n'est jamais cru sur parole

L'accès à un livre n'est accordé qu'après **relecture du paiement auprès de Genius Pay**,
jamais sur la foi d'une notification ni du retour du client sur le site. Trois chemins
mènent à cette relecture, et ils se complètent :

1. à la réception de la notification — le cas normal, en une seconde ;
2. à chaque consultation de la page de suivi par le client, au plus toutes les 10 secondes ;
3. toutes les 5 minutes, par le service `beat`, pour les paiements restés en attente.

Une notification perdue ne fait donc perdre son livre à personne.

---

## 3. Organisation du dépôt

```
fasolib/
│
├── README.md                     ce fichier : vue d'ensemble et déploiement
├── .env.example                  toutes les variables, à copier en .env
├── docker-compose.yml            développement : PostgreSQL, Redis, stockage S3
├── docker-compose.prod.yml       production : les 8 services, prêt pour Dokploy
│
├── Backend/                      l'API Django
│   ├── README.md                 installation et mise en route de l'API
│   ├── Dockerfile                image de production (Gunicorn, utilisateur non privilégié)
│   ├── config/                   réglages, routes racine, Celery, erreurs, état de santé
│   ├── apps/
│   │   ├── accounts/             comptes, connexion par jetons
│   │   ├── catalog/              catégories, livres, recherche, notes, nouveautés
│   │   ├── orders/               commandes, paiement, statistiques du tableau de bord
│   │   ├── library/              achats, exemplaires chiffrés, licences d'appareil
│   │   └── contact/              messages reçus, abonnés à la newsletter
│   └── tests/                    175 tests (pytest)
│
├── Frontend/                     le site React (espace public + back-office)
│   ├── README.md                 installation et mise en route du site
│   ├── Dockerfile                compile le site, puis le fait servir par Nginx
│   ├── public/                   images et icônes servies telles quelles
│   └── src/
│       ├── api/                  client HTTP (jetons, session) et types des réponses
│       ├── components/           briques réutilisables : boutons, tableaux, fenêtres
│       ├── features/
│       │   ├── auth/             session, connexion, contrôle d'accès
│       │   ├── public/           espace public : en-tête, cartes, formulaires
│       │   ├── reader/           lecteur intégré : PDF, EPUB
│       │   └── admin/            back-office : structure, tableau de bord, formulaires
│       ├── offline/              lecture hors ligne : IndexedDB, déchiffrement, licences
│       ├── pages/                une page par adresse
│       ├── lib/                  mise en forme des nombres et des dates
│       ├── index.css             charte graphique (couleurs, police)
│       └── router.tsx            liste des adresses
│
├── deploy/
│   ├── nginx/
│   │   ├── forwarded.conf        protocole vu du client, transmis à Django
│   │   ├── common.conf           corps du serveur : routes, cache, en-têtes de sécurité
│   │   ├── http.conf             serveur HTTP (celui qu'embarque l'image)
│   │   └── https.conf            serveur HTTPS, pour un déploiement sans Dokploy
│   └── sauvegarde.sh             sauvegarde quotidienne : base et fichiers
│
├── docs/
│   ├── EXPLOITATION.md           après la mise en ligne : sauvegardes, surveillance, pannes
│   ├── Cahier des charges…docx
│   └── Document technique…docx
│
└── .github/workflows/ci.yml      contrôles automatiques : style, tests, types, compilation
```

Dans chaque application Django, les fichiers préfixés `admin_` (`admin_views.py`,
`admin_urls.py`…) contiennent les routes `/api/admin/…`, réservées à l'administrateur.

---

## 4. Démarrer en développement

Deux guides détaillés, l'un pour chaque partie :

- **[Backend/README.md](Backend/README.md)** — PostgreSQL, Redis, stockage, l'API, Celery,
  et comment essayer un paiement avec le bac à sable de Genius Pay.
- **[Frontend/README.md](Frontend/README.md)** — le site, les règles des formulaires, le
  lecteur et le mode hors ligne.

En résumé, une fois les deux lus :

```bash
cp .env.example .env          # puis renseigner les valeurs
docker compose up -d          # PostgreSQL, Redis, stockage S3

cd Backend
python manage.py migrate && python manage.py setup_storage
python manage.py createsuperuser
python manage.py runserver                       # l'API
celery --app config worker --pool solo -l info   # les tâches de fond
celery --app config beat -l info                 # leur minuterie

cd ../Frontend
npm install && npm run dev
```

Ouvrez **http://localhost:5173** — et non `127.0.0.1`, car la session ne passe pas d'une
adresse à l'autre.

---

## 5. Déployer avec Dokploy, pas à pas

[Dokploy](https://dokploy.com) installe sur votre serveur une interface qui déploie des
applications Docker : il s'occupe du répartiteur (Traefik), des certificats HTTPS et des
redéploiements. Le projet est déjà préparé pour lui — `docker-compose.prod.yml` est écrit
dans ce sens et n'a pas à être modifié.

Comptez une heure la première fois.

### Avant de commencer

| | |
|---|---|
| **Un serveur** | Ubuntu 24.04, **4 Go de mémoire** et 30 Go de disque. Dokploy demande 2 Go au minimum, mais la compilation du site sur le serveur en réclame davantage |
| **Les ports 80, 443 et 3000 libres** | L'installation échoue si l'un d'eux est déjà pris |
| **Un nom de domaine** | Avec un enregistrement `A` qui pointe vers l'adresse IP du serveur. Vérifiez-le avant d'aller plus loin : sans lui, Let's Encrypt ne délivrera aucun certificat |
| **Le projet sur un dépôt Git** | GitHub, GitLab, Gitea… Dokploy y récupérera le code |
| **Vos clés Genius Pay de production** | Pas celles du bac à sable |

### Étape 1 — Installer Dokploy

En SSH sur le serveur, en root :

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Le script installe Docker s'il manque, puis Dokploy et Traefik. À la fin, ouvrez
`http://ADRESSE-IP-DU-SERVEUR:3000` dans votre navigateur et **créez le compte
administrateur** — le premier compte créé prend la main, faites-le tout de suite.

> **Conseil.** Donnez ensuite un domaine à Dokploy lui-même (par exemple
> `dokploy.fasolib.bf`) dans **Web Server → Domain**, puis fermez le port 3000 avec
> **Web Server → Server → Disable Port 3000**. L'interface d'administration de votre
> serveur n'a pas à rester ouverte sur Internet.

### Étape 2 — Créer le projet et le service

Dans l'interface de Dokploy :

1. **Créez un projet**, nommez-le `fasolib`.
2. Dans ce projet, **créez un service de type `Compose`**.
3. Renseignez :

| Champ | Valeur |
|---|---|
| **Compose Type** | `Docker Compose` |
| **Provider** | `GitHub` (ou `Git` avec l'adresse du dépôt) |
| **Repository** | votre dépôt FasoLib |
| **Branch** | `main` |
| **Compose Path** | `./docker-compose.prod.yml` |

4. **Enregistrez.** Ne déployez pas encore : il manque les variables d'environnement.

> `Docker Compose` et non `Stack` : le mode Stack (Docker Swarm) ne sait pas construire
> d'image à partir d'un `Dockerfile`, or le projet en construit deux.

### Étape 3 — Renseigner les variables d'environnement

Onglet **Environment** du service. Collez ce bloc, puis remplacez ce qui est entre
chevrons. Dokploy l'enregistre dans un fichier `.env` que la composition lit.

```ini
# --- Django -------------------------------------------------------------
DJANGO_SECRET_KEY=<clé générée, voir plus bas>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=fasolib.bf,www.fasolib.bf
CORS_ALLOWED_ORIGINS=https://fasolib.bf
FRONTEND_URL=https://fasolib.bf
NUM_PROXIES=2

# --- Services internes --------------------------------------------------
# Ce sont les noms des services de la composition, pas des adresses IP.
POSTGRES_DB=fasolib
POSTGRES_USER=fasolib
POSTGRES_PASSWORD=<mot de passe long, tiré au hasard>
POSTGRES_HOST=db
POSTGRES_PORT=5432

REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1

S3_ENDPOINT_URL=http://s3:7070
S3_REGION=us-east-1
S3_PRIVATE_BUCKET=fasolib-prive
S3_PUBLIC_BUCKET=fasolib-public
S3_ACCESS_KEY=fasolib
S3_SECRET_KEY=<mot de passe long, tiré au hasard>

# --- Paiement -----------------------------------------------------------
GENIUSPAY_API_KEY=<clé de production>
GENIUSPAY_API_SECRET=<clé secrète de production>
GENIUSPAY_WEBHOOK_SECRET=<secret des notifications>
GENIUSPAY_SIMULATION=False
```

Pour la clé Django, sur n'importe quelle machine :

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

**`NUM_PROXIES=2` n'est pas arbitraire.** C'est le nombre d'intermédiaires qui se
présentent devant Django : Traefik, puis Nginx. Ce chiffre lui dit où retrouver la vraie
adresse du client. Trop bas, tous vos visiteurs partageraient la même limite de tentatives
de connexion ; trop haut, la limite ne s'appliquerait plus à personne.

Trois protections refusent de laisser passer une mauvaise configuration — l'API ne démarre
pas, plutôt que de tourner en étant vulnérable :

- `GENIUSPAY_SIMULATION=True` avec `DJANGO_DEBUG=False` : le paiement simulé accorderait
  des livres sans paiement réel ;
- `GENIUSPAY_API_SECRET` ou `GENIUSPAY_WEBHOOK_SECRET` vide : les notifications seraient
  acceptées sans vérification de signature ;
- `DJANGO_ALLOWED_HOSTS` vide : toutes les requêtes sont refusées, l'oubli se voit aussitôt.

### Étape 4 — Rattacher le domaine

Onglet **Domains** du service, bouton **Add Domain** :

| Champ | Valeur |
|---|---|
| **Service** | `web` |
| **Host** | `fasolib.bf` |
| **Path** | `/` |
| **Container Port** | `80` |
| **HTTPS** | activé |
| **Certificate** | `letsencrypt` |

**C'est bien `web`, et lui seul.** Ce service sert le site *et* transmet `/api` à Django :
tout passe par une seule adresse, comme il le faut pour le cookie de session. Les autres
services — la base, le cache, l'API, les tâches — restent sur un réseau privé, sans aucune
porte sur Internet.

> Sur une composition, un changement de domaine ne prend effet qu'au redéploiement suivant.
> Le bouton **Preview Compose** montre le fichier final, avec les étiquettes Traefik que
> Dokploy a ajoutées.

### Étape 5 — Déployer

Bouton **Deploy**, puis suivez l'onglet **Deployments**.

La première fois, le serveur construit les deux images : il installe les dépendances
Python, puis compile le site React. **Comptez cinq à dix minutes.** Les fois suivantes sont
bien plus rapides, Docker réutilisant ce qui n'a pas changé.

Au démarrage, un service `migrate` crée les tables et les espaces de stockage, puis
s'arrête. Les autres ne démarrent qu'une fois cette étape réussie : si elle échoue, c'est
là qu'il faut regarder.

### Étape 6 — Créer le compte administrateur

En SSH sur le serveur :

```bash
# Retrouver le conteneur de l'API
docker ps --filter name=api --format "{{.Names}}"

# Puis, avec le nom obtenu :
docker exec -it <nom-du-conteneur> python manage.py createsuperuser
```

Ce compte ouvre le back-office, sur `https://fasolib.bf/admin/connexion`.

### Étape 7 — Déclarer les notifications de paiement

Dans le tableau de bord Genius Pay, déclarez l'adresse de notification :

```
https://fasolib.bf/geniuspay/webhook/
```

et reportez le secret associé dans `GENIUSPAY_WEBHOOK_SECRET` (étape 3), puis redéployez.

### Étape 8 — Vérifier

```bash
curl https://fasolib.bf/api/health/
# attendu : {"status": "ok"}
```

Puis, dans un navigateur :

- [ ] `https://fasolib.bf` s'ouvre, le cadenas est là, sans avertissement ;
- [ ] le catalogue affiche les couvertures ;
- [ ] la console du navigateur ne montre **aucun** message commençant par « Refused to … » ;
- [ ] un achat de bout en bout, avec un vrai paiement, puis le livre ouvert dans le lecteur.

**Une ligne reste à adapter** avant que les couvertures ne s'affichent : dans
[`deploy/nginx/common.conf`](deploy/nginx/common.conf), la règle `img-src` de la politique
de sécurité contient `https://media.example.bf`. Remplacez-la par le domaine de votre
stockage d'images, sinon le navigateur les bloquera. [EXPLOITATION.md](docs/EXPLOITATION.md)
explique aussi comment servir ce stockage sous votre propre domaine, ce qui supprime cette
ligne et rend les couvertures disponibles hors ligne.

### Étape 9 — Redéployer à chaque modification

Activez **Auto Deploy** dans l'onglet **General**, puis déclarez l'adresse de rappel
(*Webhook URL*, visible dans les journaux de déploiement) chez votre hébergeur Git. Chaque
envoi sur la branche `main` relance alors le déploiement tout seul.

Les migrations s'appliquent automatiquement avant que l'API ne reprenne les requêtes.

### Pièges à éviter

| Symptôme | Cause | Solution |
|---|---|---|
| L'installation de Dokploy échoue | Un port 80, 443 ou 3000 déjà pris | `ss -tlnp \| grep -E ':(80\|443\|3000)'`, puis arrêtez le service fautif |
| Le site boucle en redirections | `X-Forwarded-Proto` perdu en route | Le projet le gère ([`forwarded.conf`](deploy/nginx/forwarded.conf)) ; vérifiez que vous n'avez pas ajouté un autre proxy devant |
| Tous les visiteurs partagent la limite de connexion | `NUM_PROXIES` mal réglé | Mettez `2` derrière Dokploy |
| Pas de certificat HTTPS | Le domaine ne pointe pas encore vers le serveur | `dig +short fasolib.bf`, attendez la propagation DNS, puis redéployez |
| Les couvertures ne s'affichent pas | Domaine du stockage absent de la politique de sécurité | Corrigez `img-src` dans `deploy/nginx/common.conf` |
| Le serveur se fige pendant un déploiement | Pas assez de mémoire pour compiler | Passez à 4 Go, ou construisez les images en intégration continue et poussez-les dans un registre |
| « Votre exemplaire est en préparation » sans fin | Le service `worker` ne tourne pas | Regardez ses journaux dans Dokploy |

---

## 6. Après la mise en ligne

**[docs/EXPLOITATION.md](docs/EXPLOITATION.md)** prend le relais : sauvegardes de la base
et des fichiers, surveillance et lecture des journaux, mises à jour, dépannage, liste de
contrôle avant d'ouvrir au public, et la marche à suivre pour un déploiement à la main,
sans Dokploy.

---

## 7. Qualité du code

```bash
# API : style, configuration de production, tests
cd Backend
ruff check .
DJANGO_DEBUG=False python manage.py check --deploy
pytest

# Site : types et compilation
cd Frontend
npm run build
```

Ces mêmes contrôles tournent à chaque envoi de code
([.github/workflows/ci.yml](.github/workflows/ci.yml)).

### Conventions suivies

- **Le code et les commentaires sont en français**, comme le reste du projet.
- Un commentaire dit *pourquoi*, jamais *quoi* : le code dit déjà ce qu'il fait.
- Les règles métier vivent dans `services.py`, jamais dans les vues.
- Les routes de l'administrateur sont dans des fichiers `admin_*.py` séparés : aucune
  confusion possible entre ce qui est public et ce qui ne l'est pas.
- Les couleurs de la charte sont définies une seule fois, dans `Frontend/src/index.css`.
