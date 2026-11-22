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
5. [Déployer sur un VPS Hostinger, avec Dokploy](#5-déployer-sur-un-vps-hostinger-avec-dokploy)
6. [Ce qui protège un paiement](#6-ce-qui-protège-un-paiement)
7. [Le pipeline : contrôles et tests d'intrusion](#7-le-pipeline--contrôles-et-tests-dintrusion)
8. [Après la mise en ligne](#8-après-la-mise-en-ligne)
9. [Qualité du code](#9-qualité-du-code)

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
| **Mot de passe oublié** | Un lien envoyé par e-mail, valable une heure et utilisable une seule fois |
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

**Les couvertures aussi.** Nginx relaie le stockage objet sous `/media/` : les images
viennent du domaine du site, et le stockage ne quitte jamais le réseau privé de la
composition — aucun navigateur ne peut l'atteindre. Les livres, eux, sont remis par
l'API : gratuits comme achetés, ils passent par une porte qui vérifie le droit d'y
accéder.

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
│   └── tests/                    188 tests (pytest)
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
│   │   ├── limites.conf          vraie adresse du client, et limitation du débit
│   │   ├── common.conf           corps du serveur : routes, cache, en-têtes de sécurité
│   │   ├── proxy-api.conf        transmission à l'API, commune aux trois routes
│   │   └── http.conf             le serveur qu'embarque l'image (Traefik fait le HTTPS)
│   ├── env.scan-securite         réglages jetables de la pile analysée par OWASP ZAP
│   └── sauvegarde.sh             sauvegarde quotidienne : base et fichiers
│
├── docs/
│   ├── EXPLOITATION.md           après la mise en ligne : sauvegardes, surveillance, pannes
│   ├── Cahier des charges…docx
│   └── Document technique…docx
│
├── .zap/
│   ├── regles.tsv                règles OWASP ZAP éteintes, chacune justifiée
│   └── faux-positifs.tsv         occurrences écartées après vérification à la main
│
└── .github/
    ├── workflows/ci.yml          à chaque envoi : style, tests, types, compilation
    ├── workflows/securite.yml    failles connues et test d'intrusion OWASP ZAP
    └── scripts/verdict_zap.py    verdict sur le rapport de ZAP, par niveau d'alerte
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

## 5. Déployer sur un VPS Hostinger, avec Dokploy

[Dokploy](https://dokploy.com) installe sur votre serveur une interface qui déploie des
applications Docker : il s'occupe du répartiteur (Traefik), des certificats HTTPS et des
redéploiements. Le projet est déjà écrit pour lui — `docker-compose.prod.yml` n'a pas à
être modifié.

Comptez une heure la première fois. Les onze étapes se suivent dans l'ordre.

### Avant de commencer

| | |
|---|---|
| **Un nom de domaine** | Ou un sous-domaine d'un domaine que vous possédez déjà : un enregistrement `A` suffit. Dans ce guide, la plateforme vit sur `fasolib.e-busness.cloud` |
| **Vos clés Genius Pay de production** | Pas celles du bac à sable, qui doivent être révoquées |
| **Un fournisseur d'e-mail** | Adresse SMTP, identifiant, mot de passe. Sans lui, l'API **refuse de démarrer** : un client ayant perdu son mot de passe ne pourrait plus se connecter |
| **Le projet sur GitHub** | Dokploy y récupérera le code à chaque déploiement |

### Étape 1 — Commander le serveur

Dans hPanel, **VPS → Créer**. Les plans KVM, au jour où ces lignes sont écrites :

| Plan | Processeur | Mémoire | Disque |
|---|---|---|---|
| KVM 1 | 1 cœur | 4 Go | 50 Go |
| **KVM 2** *(conseillé)* | 2 cœurs | 8 Go | 100 Go |
| KVM 4 | 4 cœurs | 16 Go | 200 Go |

**Pourquoi KVM 2 plutôt que KVM 1.** C'est le serveur lui-même qui construit les images à
chaque déploiement : il installe les dépendances Python, puis compile le site React. Sur un
seul cœur avec 4 Go, cette compilation est longue et peut s'arrêter faute de mémoire,
pendant que le site continue par ailleurs de servir les visiteurs. KVM 1 suffit si la
plateforme reste petite, mais la marge de KVM 2 ne se paie qu'une fois.

Au moment de la création :

1. **Emplacement** — le centre de données le plus proche de vos lecteurs. Hostinger n'en
   propose pas en Afrique : prenez l'Europe, c'est le plus court depuis le Burkina Faso.
2. **Système** — onglet **OS with Panel**, puis **Ubuntu 24.04 with Dokploy**. Dokploy est
   alors déjà installé : vous n'avez aucun script à lancer.
3. **Accès** — ajoutez votre **clé SSH** plutôt qu'un mot de passe root.

> Si vous avez pris une image Ubuntu nue, installez Dokploy à la main, en root :
> `curl -sSL https://dokploy.com/install.sh | sh`

### Étape 2 — Prendre la main sur Dokploy

Ouvrez `http://ADRESSE-IP-DU-SERVEUR:3000` et **créez le compte administrateur tout de
suite**. Le premier compte créé prend la main sur le serveur : tant qu'il n'existe pas,
n'importe qui tombant sur cette adresse peut le créer à votre place.

Refermez ensuite la porte :

1. donnez un domaine à Dokploy lui-même — `panel.e-busness.cloud` — dans
   **Web Server → Domain** ;
2. fermez le port 3000 : **Web Server → Server → Disable Port 3000** ;
3. dans hPanel, **VPS → Pare-feu**, n'autorisez que **22** (SSH), **80** et **443**.

L'interface qui commande votre serveur n'a pas à rester ouverte sur Internet.

### Étape 3 — Faire pointer le sous-domaine

FasoLib s'installe sur un **sous-domaine** d'un domaine déjà utilisé :
`fasolib.e-busness.cloud`. Les autres enregistrements ne bougent pas, et le site déjà en
ligne sur `e-busness.cloud` continue de répondre exactement comme avant.

| Type | Nom | Valeur | | |
|---|---|---|---|---|
| `A` | `fasolib` | l'adresse IP du VPS | TTL 300 | **à créer** |
| `A` | `@`, `www` | votre site actuel | | à ne pas toucher |
| `CAA` | `@` | `0 issue "letsencrypt.org"` | | déjà là, et indispensable |

Vérifiez **avant d'aller plus loin** :

```bash
dig +short fasolib.e-busness.cloud
# attendu : l'adresse IP du VPS

curl -I http://fasolib.e-busness.cloud/
# attendu : 404. Traefik écoute déjà pour votre autre site, mais ne connaît pas encore
# ce nom : c'est l'étape 6 qui le lui apprendra.
```

Trois choses tiennent au fait que ce soit un sous-domaine.

**L'enregistrement `CAA` vaut pour tout le domaine, sous-domaines compris.** Le vôtre,
`0 issue "letsencrypt.org"`, autorise Let's Encrypt — et lui seul — à émettre un
certificat. C'est précisément l'autorité qu'emploie Dokploy : rien à changer. Mais si cet
enregistrement venait à nommer un autre émetteur, l'étape 6 échouerait sans message clair.

**Le HSTS du domaine principal s'applique ici aussi.** `e-busness.cloud` répond avec
`Strict-Transport-Security … includeSubDomains` : tout navigateur l'ayant déjà visité
refusera le HTTP en clair sur `fasolib.e-busness.cloud`. Deux conséquences — ne testez pas
en `http://`, et ne communiquez l'adresse qu'une fois le certificat délivré. Un certificat
manquant ne donne pas, ici, un avertissement que l'on contourne d'un clic : il donne une
porte close.

**Le sous-domaine suffit, seul.** Pas de `www.fasolib`, et rien à ajouter sur `@`.
L'`ALLOWED_HOSTS` de l'étape 5 ne contiendra donc qu'un seul nom.

> **Un serveur, deux sites.** Traefik les distingue par le nom demandé : ni conflit de
> port, ni certificat à partager, et le réseau `dokploy-network` existe déjà. Ce qui se
> partage vraiment, c'est la mémoire. FasoLib ajoute sept conteneurs, et la compilation du
> site React est le moment le plus gourmand : sur un serveur déjà chargé, lancez le premier
> déploiement à une heure creuse, `docker stats` ouvert à côté.

### Étape 4 — Créer le projet et le service

Dans Dokploy :

1. **créez un projet**, nommez-le `fasolib` ;
2. dans ce projet, **créez un service de type `Compose`** ;
3. renseignez :

| Champ | Valeur |
|---|---|
| **Compose Type** | `Docker Compose` |
| **Provider** | `GitHub` |
| **Repository** | votre dépôt FasoLib |
| **Branch** | `main` |
| **Compose Path** | `./docker-compose.prod.yml` |

4. **enregistrez.** Ne déployez pas encore : il manque les variables d'environnement.

> `Docker Compose` et non `Stack` : le mode Stack (Docker Swarm) ne sait pas construire
> d'image à partir d'un `Dockerfile`, or le projet en construit deux.

### Étape 5 — Renseigner les variables d'environnement

Onglet **Environment** du service. Collez ce bloc, puis remplacez ce qui est entre
chevrons. Dokploy l'enregistre dans un fichier `.env` que la composition lit.

```ini
# --- Django -------------------------------------------------------------
DJANGO_SECRET_KEY=<clé générée, voir plus bas>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=fasolib.e-busness.cloud
CORS_ALLOWED_ORIGINS=https://fasolib.e-busness.cloud
FRONTEND_URL=https://fasolib.e-busness.cloud
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
# « media » n'est pas un nom libre : c'est aussi le chemin sous lequel Nginx sert les
# couvertures. L'API refuse de démarrer avec un autre nom, plutôt que de les perdre toutes.
S3_PUBLIC_BUCKET=media
S3_ACCESS_KEY=fasolib
S3_SECRET_KEY=<mot de passe long, tiré au hasard>

# --- Envoi des e-mails (lien de réinitialisation du mot de passe) -------
EMAIL_HOST=<serveur SMTP de votre fournisseur>
EMAIL_PORT=587
EMAIL_HOST_USER=<identifiant SMTP>
EMAIL_HOST_PASSWORD=<mot de passe SMTP>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=FasoLib <ne-pas-repondre@e-busness.cloud>

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

Cinq protections refusent de laisser passer une mauvaise configuration — l'API ne
démarre pas, plutôt que de tourner en étant vulnérable, ou visiblement cassée :

- `GENIUSPAY_SIMULATION=True` avec `DJANGO_DEBUG=False` : le paiement simulé accorderait
  des livres sans paiement réel ;
- `GENIUSPAY_API_SECRET` ou `GENIUSPAY_WEBHOOK_SECRET` vide : les notifications seraient
  acceptées sans vérification de signature ;
- `EMAIL_HOST` vide : les liens de réinitialisation partiraient dans la console du
  serveur, et un client ayant perdu son mot de passe ne pourrait plus se connecter ;
- `DJANGO_ALLOWED_HOSTS` vide : toutes les requêtes sont refusées, l'oubli se voit aussitôt ;
- `S3_PUBLIC_BUCKET` différent de `media` : les couvertures seraient demandées à une
  adresse que Nginx ne sert pas, et le catalogue s'afficherait sans aucune image.

### Étape 6 — Rattacher le domaine

Onglet **Domains** du service, bouton **Add Domain** :

| Champ | Valeur |
|---|---|
| **Service** | `web` |
| **Host** | `fasolib.e-busness.cloud` |
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

### Étape 7 — Déployer

Bouton **Deploy**, puis suivez l'onglet **Deployments**.

La première fois, le serveur construit les deux images : il installe les dépendances
Python, puis compile le site React. **Comptez cinq à dix minutes.** Les fois suivantes sont
bien plus rapides, Docker réutilisant ce qui n'a pas changé.

Au démarrage, un service `migrate` crée les tables et les espaces de stockage, puis
s'arrête. Les autres ne démarrent qu'une fois cette étape réussie : si elle échoue, c'est
là qu'il faut regarder.

### Étape 8 — Créer le compte administrateur

En SSH sur le serveur :

```bash
# Retrouver le conteneur de l'API
docker ps --filter name=api --format "{{.Names}}"

# Puis, avec le nom obtenu :
docker exec -it <nom-du-conteneur> python manage.py createsuperuser
```

Ce compte ouvre le back-office, sur `https://fasolib.e-busness.cloud/admin/connexion`.

### Étape 9 — Déclarer les notifications de paiement

Dans le tableau de bord Genius Pay, déclarez l'adresse de notification :

```
https://fasolib.e-busness.cloud/geniuspay/webhook/
```

et reportez le secret associé dans `GENIUSPAY_WEBHOOK_SECRET` (étape 5), puis redéployez.

### Étape 10 — Vérifier

```bash
curl https://fasolib.e-busness.cloud/api/health/
# attendu : {"status": "ok"}
```

Puis, dans un navigateur :

- [ ] `https://fasolib.e-busness.cloud` s'ouvre, le cadenas est là, sans avertissement ;
- [ ] le site déjà en ligne sur `e-busness.cloud` répond toujours ;
- [ ] le catalogue affiche les couvertures ;
- [ ] la console du navigateur ne montre **aucun** message commençant par « Refused to … » ;
- [ ] un achat de bout en bout, avec un vrai paiement, puis le livre ouvert dans le lecteur ;
- [ ] un « mot de passe oublié » demandé depuis la page de connexion, et l'e-mail bien reçu.

**Rien à adapter pour les couvertures.** Elles sont servies par votre domaine, sous
`/media/` : Nginx relaie le stockage objet, qui reste sur le réseau privé de la
composition. Aucune autre origine n'entre donc dans la politique de sécurité, et le
service worker peut les garder pour l'affichage hors ligne.

### Étape 11 — Redéployer à chaque modification

Activez **Auto Deploy** dans l'onglet **General**, puis déclarez l'adresse de rappel
(*Webhook URL*, visible dans les journaux de déploiement) chez GitHub, dans
**Settings → Webhooks**. Chaque envoi sur `main` relance alors le déploiement tout seul.

La branche déclarée dans Dokploy doit être celle que vous poussez, sans quoi le
déploiement s'arrête sur « Branch Not Match ».

Les migrations s'appliquent automatiquement avant que l'API ne reprenne les requêtes.

> **Aucun fichier du dépôt n'est monté dans un conteneur**, et c'est voulu : à chaque
> déploiement, Dokploy vide le dossier puis refait un `git clone`. Un fichier monté depuis
> `./` disparaîtrait en route. Les configurations Nginx sont donc **intégrées aux images**
> au moment de leur construction, et les données vivent dans des volumes Docker nommés,
> que rien n'efface.

### Pièges à éviter

| Symptôme | Cause | Solution |
|---|---|---|
| L'installation de Dokploy échoue | Un port 80, 443 ou 3000 déjà pris | Repérez le service fautif avec `ss -tlnp`, puis arrêtez-le |
| Le site boucle en redirections | `X-Forwarded-Proto` perdu en route | Le projet le gère ([`forwarded.conf`](deploy/nginx/forwarded.conf)) ; vérifiez qu'aucun autre proxy n'a été ajouté devant |
| Tous les visiteurs partagent la limite de connexion | `NUM_PROXIES` mal réglé | Mettez `2` derrière Dokploy |
| Pas de certificat HTTPS | Le sous-domaine ne pointe pas encore vers le serveur | `dig +short fasolib.e-busness.cloud`, attendez la propagation DNS, puis redéployez |
| Pas de certificat, alors que le DNS est bon | L'enregistrement `CAA` du domaine n'autorise pas Let's Encrypt | Vérifiez `dig CAA e-busness.cloud` : il doit contenir `issue "letsencrypt.org"` |
| Le sous-domaine répond `404 page not found` | C'est Traefik : il écoute, mais aucun service ne porte encore ce nom | Ajoutez le domaine à l'étape 6, puis **redéployez** — sur une composition, le changement n'est pris qu'au déploiement suivant |
| Le navigateur refuse d'ouvrir le site en `http://` | Le HSTS du domaine principal couvre ses sous-domaines | C'est voulu. Ouvrez `https://`, une fois le certificat délivré |
| Les couvertures ne s'affichent pas | Le compartiment public ne s'appelle pas `media`, ou le service `s3` est arrêté | L'API refuse de démarrer dans le premier cas ; dans le second, regardez les journaux de `s3` et testez `/media/` depuis le conteneur `web` |
| Le serveur se fige pendant un déploiement | Pas assez de mémoire pour compiler | Passez à KVM 2, ou construisez les images ailleurs |
| « Votre exemplaire est en préparation » sans fin | Le service `worker` ne tourne pas | Regardez ses journaux dans Dokploy |

---

## 6. Ce qui protège un paiement

Un paiement met en jeu de l'argent réel et l'accès à un livre : c'est la partie la plus
convoitée de la plateforme. La défense n'y repose pas sur une barrière unique, mais sur
une suite de vérifications dont chacune suffirait, seule, à faire échouer l'attaque.

| Ce qu'un attaquant tenterait | Ce qui l'en empêche |
|---|---|
| Payer 100 F un livre à 5 000 F | Le prix n'est **jamais** lu dans la requête : la commande est créée à partir du prix du livre en base |
| Annoncer un paiement qui n'a pas eu lieu | Aucune notification n'accorde de livre : le paiement est **relu auprès de Genius Pay** avant toute décision (voir [§ 2](#un-paiement-nest-jamais-cru-sur-parole)) |
| Falsifier une notification | Le SDK vérifie la **signature HMAC-SHA256** et l'horodatage avant même que notre code ne la voie |
| Rejouer une notification valide | Chaque notification porte un identifiant unique, enregistré : la seconde fois, elle est ignorée |
| Payer une fois, être servi deux fois | La commande est verrouillée en base le temps d'être conclue (`select_for_update`) |
| Doubler un paiement en cliquant deux fois | Une commande du même livre encore en attente est **reprise**, jamais doublée |
| Payer deux fois le même livre malgré tout | Le second paiement est refusé et **journalisé comme à rembourser**, au lieu d'accorder le livre deux fois |
| Noyer le serveur sous de fausses notifications | Nginx limite à 60 notifications par minute et par adresse, avant que Django ne soit sollicité |
| Essayer des mots de passe en masse | 20 tentatives par minute et par adresse chez Nginx, puis une limite plus fine côté Django |
| Activer le paiement simulé en production | `GENIUSPAY_SIMULATION=True` avec `DJANGO_DEBUG=False` **empêche l'API de démarrer** |

Deux de ces défenses méritent une précision, car elles se règlent mal.

**La vraie adresse du client.** Derrière Traefik, toutes les requêtes se présentent avec
l'adresse du répartiteur. Une limitation par adresse punirait alors tous les visiteurs
ensemble, et les journaux ne diraient jamais qui fait quoi.
[`limites.conf`](deploy/nginx/limites.conf) rétablit l'adresse d'origine, en ne faisant
confiance qu'aux réseaux privés : aucun visiteur ne peut s'inventer une autre adresse,
puisque personne ne joint ce conteneur directement.

**Les secrets.** Ils ne sont nulle part dans le dépôt : ni dans le code, ni dans les
images, ni dans un fichier d'exemple. Ils vivent dans l'onglet **Environment** de Dokploy,
et c'est tout. Un dépôt rendu public demain ne livrerait rien.

---

## 7. Le pipeline : contrôles et tests d'intrusion

Deux chaînes tournent chez GitHub, pour deux questions différentes.

| Chaîne | Quand | Ce qu'elle vérifie |
|---|---|---|
| [**Contrôles**](.github/workflows/ci.yml) | à chaque envoi et à chaque proposition de modification | Style du code, configuration de production, 188 tests, types du site, compilation |
| [**Sécurité**](.github/workflows/securite.yml) | à chaque envoi sur `main`, **chaque lundi**, et à la demande | Failles connues des bibliothèques, puis test d'intrusion OWASP ZAP |

Le passage hebdomadaire n'est pas une redite : une faille publiée demain touche un code
qui, lui, n'a pas bougé. C'est tout l'intérêt de répéter l'analyse dans le temps.

### Les failles connues des bibliothèques

`pip-audit`, l'outil de la fondation Python, compare les versions installées à la base
publique des vulnérabilités. Côté site, `npm audit` fait de même, en n'arrêtant la chaîne
que sur les failles **élevées et critiques** : l'écosystème npm en signale beaucoup qui ne
concernent que des outils de compilation, jamais exécutés chez le visiteur.

> **Une correction imposée, et pourquoi.** Le lecteur EPUB (`epubjs`) s'appuie sur
> l'analyseur XML `@xmldom/xmldom`, dont la version entraînée était vulnérable. La
> correction proposée par `npm audit` — passer à `epubjs@0.4.2` — était un piège : malgré
> son numéro, cette version est **plus ancienne** que celle employée et dépend d'un
> analyseur encore plus exposé. Le `overrides` du `package.json` impose donc
> `@xmldom/xmldom@^0.8.15`, hors de toutes les plages signalées. Lecture d'un EPUB
> vérifiée ensuite dans un navigateur : manifeste lu, chapitre affiché.

### Le test d'intrusion OWASP ZAP

[OWASP ZAP](https://www.zaproxy.org/) est l'outil libre de référence pour éprouver une
application web. Ici, il n'attaque ni une maquette ni le site en production, mais **la
vraie pile de production** : mêmes images, même Nginx, même Gunicorn, montée pour
l'occasion sur une base vide, puis détruite avec ses volumes.

Le déroulement :

1. la pile est construite à partir de `docker-compose.prod.yml` ;
2. une vérification s'assure qu'**aucun service ne redémarre en boucle** — un worker mort
   ne se voit pas depuis le site, mais plus aucun livre acheté ne serait préparé ;
3. **le site est parcouru** à travers Nginx, et chaque réponse passe au crible des règles
   passives d'OWASP : en-têtes, politique de sécurité, cookies, fuites d'information ;
4. **l'API est attaquée** route par route, avec de vraies charges hostiles — injection
   SQL, traversée de chemin, XSS ;
5. les deux rapports sont conservés **30 jours** comme fichiers joints à l'exécution.

**Pourquoi deux passes, et non une.** Le site est une application React : l'araignée de
ZAP n'y découvre aucune adresse d'API, car rien n'y est écrit en clair dans le HTML. La
seconde passe est donc pilotée par le **schéma OpenAPI** que l'API produit elle-même — 75
adresses, décrites par le code, jamais par une liste à tenir à jour.

**Pourquoi l'API est visée directement, sans passer par Nginx.** Un scanner actif envoie
des milliers de requêtes : la limitation de débit répondrait 429 dès la deuxième seconde,
et masquerait les failles applicatives au lieu de les révéler. Cette limitation, elle, est
éprouvée par la première passe et par les tests. Chaque défense est ainsi mesurée là où
elle agit.

**Ce qui bloque la mise en production.** ZAP ne sait qu'échouer sur toutes les alertes ou
sur aucune. [`verdict_zap.py`](.github/scripts/verdict_zap.py) tranche à sa place : une
alerte **élevée** arrête la chaîne, les alertes moyennes et faibles sont résumées dans le
compte rendu de l'exécution, sans bloquer.

### Écarter une alerte, sans désarmer l'outil

Deux fichiers, et la différence entre les deux compte.

| Fichier | Portée | Quand s'en servir |
|---|---|---|
| [`.zap/regles.tsv`](.zap/regles.tsv) | Éteint **une règle entière** | Une règle sans objet sur cette plateforme. Il n'y en a aucune aujourd'hui |
| [`.zap/faux-positifs.tsv`](.zap/faux-positifs.tsv) | Écarte **une occurrence précise** : règle, méthode, adresse, paramètre | Une alerte vérifiée à la main et comprise comme fausse |

Une injection SQL ne s'éteint jamais par la première voie. Les trois occurrences écartées
aujourd'hui l'ont été une à une, avec la vérification qui les accompagne : aucune requête
SQL brute dans le projet, charge rejouée à la main et refusée à la validation, et un
`DROP TABLE` envoyé pour de bon qui n'a rien détruit. La même règle, sur une autre adresse
ou un autre paramètre, bloque toujours.

### Rejouer l'analyse chez soi

La chaîne ne fait rien d'autre que ces commandes : un échec se reproduit donc à
l'identique sur votre machine, sans rien deviner.

```bash
cp deploy/env.scan-securite .env          # écrase votre .env : à restaurer ensuite
docker network create dokploy-network
export COMPOSE_PROJECT_NAME=fasolib-scan
docker compose --file docker-compose.prod.yml up --build --detach

mkdir -p rapport && cp .zap/regles.tsv rapport/ && chmod -R 777 rapport
ZAP=ghcr.io/zaproxy/zaproxy:stable
PROTO="-config replacer.full_list(0).description=protocole \
-config replacer.full_list(0).enabled=true \
-config replacer.full_list(0).matchtype=REQ_HEADER \
-config replacer.full_list(0).matchstr=X-Forwarded-Proto \
-config replacer.full_list(0).regex=false \
-config replacer.full_list(0).replacement=https"

# 1. Le site, à travers Nginx
docker run --rm --network fasolib-scan_interne --volume "$PWD/rapport:/zap/wrk:rw" $ZAP \
  zap-baseline.py -t http://web -c regles.tsv -J site.json -r site.html -I -z "$PROTO"

# 2. L'API, pilotée par son schéma
docker compose --file docker-compose.prod.yml exec -T api \
  python manage.py spectacular --format openapi --file /tmp/schema.yml
docker compose --file docker-compose.prod.yml cp api:/tmp/schema.yml rapport/schema.yml
docker run --rm --network fasolib-scan_interne --volume "$PWD/rapport:/zap/wrk:rw" $ZAP \
  zap-api-scan.py -t schema.yml -f openapi -O http://api:8000 \
  -c regles.tsv -J api.json -r api.html -I -z "$PROTO"

python .github/scripts/verdict_zap.py rapport/site.json
python .github/scripts/verdict_zap.py rapport/api.json

docker compose --file docker-compose.prod.yml down --volumes
```

Les rapports lisibles sont `rapport/site.html` et `rapport/api.html`.

---

## 8. Après la mise en ligne

**[docs/EXPLOITATION.md](docs/EXPLOITATION.md)** prend le relais : sauvegardes de la base
et des fichiers, surveillance et lecture des journaux, mises à jour, dépannage, liste de
contrôle avant d'ouvrir au public, et la marche à suivre pour un déploiement à la main,
sans Dokploy.

---

## 9. Qualité du code

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
([.github/workflows/ci.yml](.github/workflows/ci.yml)), et les contrôles de sécurité
s'y ajoutent chaque semaine ([§ 7](#7-le-pipeline--contrôles-et-tests-dintrusion)).

### Conventions suivies

- **Le code et les commentaires sont en français**, comme le reste du projet.
- Un commentaire dit *pourquoi*, jamais *quoi* : le code dit déjà ce qu'il fait.
- Les règles métier vivent dans `services.py`, jamais dans les vues.
- Les routes de l'administrateur sont dans des fichiers `admin_*.py` séparés : aucune
  confusion possible entre ce qui est public et ce qui ne l'est pas.
- Les couleurs de la charte sont définies une seule fois, dans `Frontend/src/index.css`.
