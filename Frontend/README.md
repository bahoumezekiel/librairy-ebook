# FasoLib – Back-office (interface d'administration)

Interface web réservée à l'administrateur de FasoLib : tableau de bord, livres, catégories, commandes et clients.
Elle est écrite en React et TypeScript, et dialogue avec l'API du dossier `Backend`.

Les commandes sont à lancer depuis le dossier `Frontend`.

## 1. Ce qu'il faut avoir

| Élément | Remarque |
|---|---|
| Node.js 22 ou plus, avec npm | Le projet est testé avec Node.js 26 |
| L'API démarrée | Sur http://127.0.0.1:8000 (voir `Backend/README.md`) |
| Un compte administrateur | Créé côté API avec `python manage.py createsuperuser` |

Node.js sert uniquement à développer et à compiler l'interface. En production, le résultat est un ensemble de fichiers statiques : aucun serveur Node.js ne tourne.

## 2. Installer les dépendances

```powershell
npm install
```

## 3. Démarrer en développement

```powershell
npm run dev
```

Ouvrez ensuite http://localhost:5173 et connectez-vous avec le compte administrateur.

Aucun fichier de configuration n'est nécessaire : le serveur de développement transmet lui-même tous les appels `/api` à l'API sur `http://127.0.0.1:8000`. Si votre API écoute sur une autre adresse, modifiez la ligne `proxy` de `vite.config.ts`.

## 4. Les commandes utiles

| Commande | Effet |
|---|---|
| `npm run dev` | Lance l'interface en développement, avec rechargement automatique |
| `npm run typecheck` | Vérifie les types TypeScript sans rien produire |
| `npm run build` | Vérifie les types, puis compile l'interface dans le dossier `dist` |
| `npm run preview` | Sert le contenu de `dist` pour un dernier contrôle avant mise en ligne |

## 5. Ce que contient l'interface

| Section | Adresse | Ce qu'on y fait |
|---|---|---|
| Connexion | `/connexion` | S'identifier avec son e-mail et son mot de passe |
| Tableau de bord | `/admin` | Suivre le chiffre d'affaires, les commandes, la conversion et les nouveaux clients sur 7, 30 ou 90 jours, comparés à la période précédente |
| Livres | `/admin/livres` | Ajouter, modifier, publier, retirer ou supprimer un livre ; rechercher et filtrer |
| Catégories | `/admin/categories` | Ajouter, modifier, ordonner ou supprimer une catégorie |
| Commandes | `/admin/commandes` | Consulter les commandes et leur paiement, filtrer par statut |
| Clients | `/admin/clients` | Consulter les comptes inscrits |
| Messages | `/admin/messages` | Lire les messages du formulaire de contact, y répondre par e-mail, les supprimer |
| Newsletter | `/admin/newsletter` | Voir les abonnés, copier toutes leurs adresses, désinscrire une adresse |

La connexion à l'administration se fait par `/admin/connexion`, distincte de celle de l'espace public.

Un compte qui n'est pas administrateur ne peut pas ouvrir ces sections : il voit un message « Accès réservé à l'administrateur ».

Le même projet contient aussi l'espace public :

| Page | Adresse | Accès |
|---|---|---|
| Accueil | `/` | Tout le monde |
| Catalogue (recherche, filtres, tri) | `/catalogue` | Tout le monde |
| Fiche d'un livre (téléchargement, achat, note) | `/livres/…` | Tout le monde ; acheter et noter demandent un compte |
| Inscription | `/inscription` | Tout le monde |
| Ma bibliothèque | `/bibliotheque` | Client connecté ; fonctionne aussi sans réseau |
| Lecteur | `/lire/…` | Client qui a acheté le livre ; fonctionne aussi sans réseau |
| Suivi d'une commande | `/commandes/…` | Client connecté |

Ouvrez toujours le site par `http://localhost:5173` (et non `127.0.0.1`) : c'est l'adresse vers laquelle l'API renvoie le client après un paiement, et la session ne passe pas d'une adresse à l'autre.

### Règles appliquées par les formulaires

- Un livre est **gratuit** ou **payant** ; un livre payant coûte au moins 200 FCFA.
- Couverture : JPEG, PNG ou WebP, 10 Mo au maximum, 5 000 pixels de côté au maximum. Les cartes du catalogue l'affichent au format **2:3** (par exemple 1000 × 1500 pixels), la proportion d'une couverture de livre : une image à cette proportion s'affiche entière, sans rognage.
- Fichier du livre : PDF ou EPUB, 100 Mo au maximum. Le nom du fichier envoyé peut être de n'importe quelle longueur : il est remplacé par un nom court et aléatoire.
- Une catégorie qui contient des livres ne peut pas être supprimée.
- Un livre déjà commandé ne peut pas être supprimé : retirez-le du catalogue avec l'interrupteur « Publié ».

L'API vérifie toutes ces règles de son côté ; l'interface ne fait que prévenir plus tôt.

### Lecteur intégré et lecture hors ligne

Un livre payant ne se télécharge jamais : il se lit dans le lecteur intégré (PDF.js pour les PDF, epub.js pour les EPUB).

**Un livre acheté l'est à vie.** Un achat n'a pas de date de fin en base, et il reste lisible en ligne quoi qu'il arrive. La durée de 30 jours décrite ci-dessous ne concerne que la lecture *sans réseau*, appareil par appareil : elle sert uniquement à libérer une place quand un appareil n'est plus utilisé, sans quoi la limite de 3 appareils deviendrait définitive. Cette durée n'est jamais présentée au client comme une échéance.

1. À la première ouverture, le serveur vérifie l'achat et la limite de 3 appareils, puis renvoie une clé et une licence de 30 jours.
2. Le livre chiffré est téléchargé une fois et rangé dans le navigateur (IndexedDB), avec sa clé. La clé y est stockée de façon non exportable : aucun script ne peut en lire la valeur.
3. À chaque ouverture, le livre est déchiffré en mémoire seulement. Le texte en clair n'est jamais enregistré, et il est oublié dès que l'on quitte le lecteur.
4. Sans réseau, le livre s'ouvre tant que la licence court. De retour en ligne, chaque ouverture la renouvelle pour 30 jours.

Protections du lecteur : pas de bouton de téléchargement, menu contextuel et impression désactivés, texte non sélectionnable. Les PDF portent le nom et l'e-mail de l'acheteur en bas de chaque page (ajoutés par le serveur), les EPUB un filigrane affiché par-dessus. À la déconnexion, tous les livres enregistrés sur l'appareil sont effacés.

Le site est aussi une application installable : le navigateur propose de l'ajouter à l'écran d'accueil, et l'interface s'ouvre sans réseau.

**Pour tester le mode hors ligne**, il faut la version compilée : le service worker n'est pas actif avec `npm run dev`.

```powershell
npm run build
npm run preview
```

Ouvrez http://localhost:4173, connectez-vous, ouvrez un livre acheté, puis coupez le réseau (outils de développement du navigateur, onglet « Réseau », option « Hors connexion ») et rechargez la page.

## 6. Mise en production

La marche à suivre est dans le **[README du projet](../README.md#5-déployer-avec-dokploy-pas-à-pas)** : `Frontend/Dockerfile` compile l'interface puis la fait servir par Nginx, qui transmet `/api` et `/geniuspay` à Django. Rien n'est à faire à la main.

Pour compiler sans Docker :

```powershell
npm run build
```

Le dossier `dist` contient alors l'interface compilée. Le serveur web qui la sert doit appliquer deux règles, déjà écrites dans `deploy/nginx/common.conf` :

- les adresses qui commencent par `/api/` et `/geniuspay/` sont transmises à Django ;
- toutes les autres renvoient `dist/index.html`, pour que les adresses comme `/admin/livres` fonctionnent après un rechargement de la page.

L'interface et l'API doivent partager le même nom de domaine : la session repose sur un cookie qui n'est jamais envoyé vers un autre site.

## 7. Problèmes fréquents

| Symptôme | Cause probable | Solution |
|---|---|---|
| « Connexion au serveur impossible » à la connexion | L'API n'est pas démarrée | Lancez `python manage.py runserver` dans `Backend` |
| « Adresse e-mail ou mot de passe incorrect » | Mauvais identifiants, ou aucun compte créé | Créez le compte avec `python manage.py createsuperuser` |
| « Accès réservé à l'administrateur » | Le compte est un compte client | Connectez-vous avec le compte créé par `createsuperuser` |
| Un message 429 après plusieurs essais | Plus de 10 tentatives de connexion en une minute | Attendez une minute |
| Les couvertures ne s'affichent pas | Le stockage de fichiers est arrêté | `docker compose up -d redis s3` à la racine du projet |
| Le port 5173 est déjà utilisé | Une autre instance tourne | Fermez-la, ou lancez `npm run dev -- --port 5174` et ajoutez cette adresse à `CORS_ALLOWED_ORIGINS` dans `.env` |

## 8. Organisation du code

```
Frontend/
├─ public/            images servies telles quelles (photo de la page de connexion, icône)
└─ src/
   ├─ api/            client HTTP (jetons, renouvellement de session) et types des réponses
   ├─ components/     composants réutilisables : boutons, cartes, tableaux, fenêtres, onglets
   ├─ features/
   │  ├─ auth/        session de l'utilisateur, connexion, inscription, contrôle d'accès
   │  ├─ public/      espace public : en-tête, pied de page, cartes de livres, formulaires
   │  ├─ reader/      lecteur intégré : PDF, EPUB, ouverture d'un livre acheté
   │  └─ admin/       structure du back-office, tableau de bord, formulaires
   ├─ lib/            mise en forme des nombres et des dates
   ├─ offline/        lecture hors ligne : stockage IndexedDB, déchiffrement, licences d'appareil
   ├─ pages/          une page par adresse
   ├─ index.css       charte graphique (couleurs, police)
   └─ router.tsx      liste des adresses de l'interface
```

Les couleurs de la charte sont définies une seule fois, dans `src/index.css`.
