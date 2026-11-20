#!/bin/sh
# Sauvegarde quotidienne de FasoLib : la base de données et les fichiers des livres.
#
# À lancer depuis la racine du projet, par le crontab du serveur (voir DEPLOIEMENT.md).
# Copiez ensuite le dossier produit hors du serveur : une sauvegarde qui reste sur la
# machine sauvegardée ne protège de rien.

set -eu

COMPOSE="docker compose --file docker-compose.prod.yml"
DESTINATION="${FASOLIB_SAUVEGARDES:-./sauvegardes}"
JOUR=$(date +%F)
# Nombre de jours de sauvegardes gardés sur place.
GARDE_JOURS=14

mkdir -p "$DESTINATION"

# Les identifiants sont lus dans le conteneur : ils ne passent pas par la ligne de commande.
echo "[$(date +%T)] Base de données…"
$COMPOSE exec -T db sh -c \
  'pg_dump --username "$POSTGRES_USER" --format custom "$POSTGRES_DB"' \
  > "$DESTINATION/base-$JOUR.dump"

echo "[$(date +%T)] Fichiers des livres…"
docker run --rm \
  --volumes-from "$($COMPOSE ps --quiet s3)" \
  --volume "$(pwd)/$DESTINATION:/sortie" \
  alpine tar czf "/sortie/fichiers-$JOUR.tar.gz" /data

# Les sauvegardes sont lisibles par leur seul propriétaire : elles contiennent les
# adresses des clients et les exemplaires chiffrés des livres.
chmod 600 "$DESTINATION/base-$JOUR.dump" "$DESTINATION/fichiers-$JOUR.tar.gz"

find "$DESTINATION" -name 'base-*.dump' -mtime "+$GARDE_JOURS" -delete
find "$DESTINATION" -name 'fichiers-*.tar.gz' -mtime "+$GARDE_JOURS" -delete

echo "[$(date +%T)] Terminé : $DESTINATION/base-$JOUR.dump et fichiers-$JOUR.tar.gz"
