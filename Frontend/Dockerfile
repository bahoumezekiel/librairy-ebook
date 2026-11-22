# Image du site FasoLib : le site React compilé, servi par Nginx, qui transmet /api à l'API.
# Node.js ne sert qu'à la compilation : l'image finale ne contient que des fichiers statiques.
#
# À construire depuis la racine du projet, car la configuration Nginx y est partagée :
#   docker build --file Frontend/Dockerfile --tag fasolib-web .

FROM node:26-alpine AS build

WORKDIR /app

# `npm ci` installe exactement les versions du package-lock.json, sans jamais les faire évoluer.
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm ci

COPY Frontend/ ./
# `npm run build` vérifie aussi les types : une erreur de type arrête la construction.
RUN npm run build

FROM nginx:1-alpine

# `conf.d` est inclus automatiquement par Nginx, dans l'ordre alphabétique : la
# correspondance du protocole client doit y être lue avant le site, d'où le préfixe `00-`.
# `common.conf` est rangé ailleurs : il n'a de sens qu'à l'intérieur d'un bloc `server`.
COPY deploy/nginx/forwarded.conf /etc/nginx/conf.d/00-forwarded.conf
COPY deploy/nginx/limites.conf /etc/nginx/conf.d/01-limites.conf
COPY deploy/nginx/common.conf /etc/nginx/fasolib/common.conf
COPY deploy/nginx/proxy-api.conf /etc/nginx/fasolib/proxy-api.conf
COPY deploy/nginx/http.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --spider http://127.0.0.1/index.html || exit 1
