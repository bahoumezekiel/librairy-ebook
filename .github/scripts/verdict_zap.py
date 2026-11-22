"""
Verdict du pipeline sur un rapport d'OWASP ZAP.

ZAP ne sait qu'échouer sur *toutes* les alertes ou sur aucune. Or une alerte basse —
« le serveur accepte d'être mis en cache » — n'a pas à empêcher une mise en production,
là où une alerte élevée le doit. Ce script tranche : il résume le rapport lisiblement
dans le compte rendu du pipeline, et ne bloque que sur le niveau élevé.

Il écarte au passage les occurrences consignées dans `.zap/faux-positifs.tsv`, vérifiées
une à une à la main. L'écartement vaut pour une adresse et un paramètre précis : la même
règle sur une autre adresse bloque toujours.

    python .github/scripts/verdict_zap.py rapport/rapport.json
"""

import json
import os
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

# Niveaux de risque de ZAP, du plus grave au plus anodin.
NIVEAUX = {3: "Élevé", 2: "Moyen", 1: "Faible", 0: "Information"}
BLOQUANT = 3
ZAP = Path(__file__).resolve().parents[2] / ".zap"
FAUX_POSITIFS = ZAP / "faux-positifs.tsv"
REGLES = ZAP / "regles.tsv"


def lignes_utiles(chemin):
    """Lignes d'un fichier de configuration ZAP, sans les commentaires ni les vides."""
    if not chemin.exists():
        return []
    return [
        ligne
        for ligne in chemin.read_text(encoding="utf-8").splitlines()
        if ligne.strip() and not ligne.startswith("#")
    ]


def lire_regles_eteintes(chemin=REGLES):
    """Règles mises à IGNORE : ZAP les écarte déjà, ce résumé n'a pas à les rappeler."""
    return {
        champs[0].strip()
        for ligne in lignes_utiles(chemin)
        if (champs := ligne.split("\t")) and len(champs) > 1 and champs[1].strip() == "IGNORE"
    }


def lire_faux_positifs(chemin=FAUX_POSITIFS):
    """Occurrences écartées : (règle, méthode, chemin, paramètre)."""
    return {
        tuple(champ.strip() for champ in ligne.split("\t")[:4]) for ligne in lignes_utiles(chemin)
    }


def retenues(alerte, ecartees):
    """Occurrences de l'alerte qui ne sont pas des faux positifs connus."""
    return [
        instance
        for instance in alerte.get("instances", [])
        if (
            alerte["pluginid"],
            instance.get("method", ""),
            urlparse(instance.get("uri", "")).path,
            instance.get("param", ""),
        )
        not in ecartees
    ]


def lire_alertes(chemin):
    """Alertes du rapport, aplaties : ZAP les groupe par site analysé."""
    rapport = json.loads(Path(chemin).read_text(encoding="utf-8"))
    return [alerte for site in rapport.get("site", []) for alerte in site.get("alerts", [])]


def tableau(examinees):
    """Résumé en Markdown, trié du plus grave au plus anodin."""
    lignes = ["| Niveau | Alerte | Occurrences | Écartées |", "|---|---|---|---|"]
    for alerte, gardees in sorted(examinees, key=lambda e: -int(e[0]["riskcode"])):
        niveau = NIVEAUX.get(int(alerte["riskcode"]), alerte["riskdesc"])
        ecartees = len(alerte.get("instances", [])) - len(gardees)
        lignes.append(f"| {niveau} | {alerte['alert']} | {len(gardees)} | {ecartees or '—'} |")
    return "\n".join(lignes)


def publier(texte):
    """Écrit le résumé dans le compte rendu du pipeline, et toujours sur la sortie."""
    print(texte)
    resume = os.environ.get("GITHUB_STEP_SUMMARY")
    if resume:
        with open(resume, "a", encoding="utf-8") as fichier:
            fichier.write(texte + "\n")


def main(chemin):
    ecartees = lire_faux_positifs()
    eteintes = lire_regles_eteintes()
    toutes = [
        (alerte, retenues(alerte, ecartees))
        for alerte in lire_alertes(chemin)
        if alerte["pluginid"] not in eteintes
    ]
    # Une alerte dont toutes les occurrences sont écartées disparaît du tableau, mais
    # jamais en silence : le compte figure sous le résumé.
    examinees = [(alerte, gardees) for alerte, gardees in toutes if gardees]
    nombre_ecartees = sum(len(a.get("instances", [])) - len(g) for a, g in toutes)
    mention = (
        f"\n\n{nombre_ecartees} occurrence(s) écartée(s) d'après `.zap/faux-positifs.tsv`."
        if nombre_ecartees
        else ""
    )

    if not examinees:
        publier(f"## OWASP ZAP\n\nAucune alerte à retenir.{mention}")
        return 0

    comptes = Counter(int(alerte["riskcode"]) for alerte, _ in examinees)
    repartition = ", ".join(
        f"{comptes[code]} × {nom.lower()}" for code, nom in NIVEAUX.items() if comptes[code]
    )
    publier(
        f"## OWASP ZAP\n\n{len(examinees)} alertes : {repartition}."
        f"\n\n{tableau(examinees)}{mention}"
    )

    elevees = comptes[BLOQUANT]
    if elevees:
        # `::error::` fait remonter le message en tête de l'exécution, sur GitHub.
        print(f"::error::{elevees} alerte(s) de niveau élevé : la mise en production est bloquée.")
        return 1
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage : verdict_zap.py <rapport json de ZAP>")
    sys.exit(main(sys.argv[1]))
