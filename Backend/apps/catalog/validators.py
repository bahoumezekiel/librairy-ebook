"""
Contrôle des fichiers téléversés par l'administrateur.

Le type est déduit du contenu réel du fichier, jamais de son nom ni de l'en-tête
envoyé par le navigateur. Le fichier est ensuite renommé d'après ce type.
"""

import zipfile

from pypdf import PdfReader
from rest_framework.exceptions import ValidationError

from .models import Book

# Montant minimal accepté par Genius Pay pour un paiement, en francs CFA.
MIN_PRICE = 200

MAX_BOOK_SIZE = 100 * 1024 * 1024
MAX_COVER_SIZE = 10 * 1024 * 1024
# Une image légère peut cacher des dimensions énormes (image « bombe ») : on les borne.
MAX_COVER_SIDE = 5000

# Formats d'image acceptés (noms Pillow) et extension enregistrée.
COVER_EXTENSIONS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}


def check_cover(cover):
    """Valide une couverture déjà reconnue comme image par DRF (taille, dimensions, format)."""
    _check_size(cover, MAX_COVER_SIZE)
    if max(cover.image.size) > MAX_COVER_SIDE:
        raise ValidationError(f"L'image dépasse {MAX_COVER_SIDE} pixels de côté.")
    extension = COVER_EXTENSIONS.get(cover.image.format)
    if extension is None:
        raise ValidationError("La couverture doit être une image JPEG, PNG ou WebP.")
    cover.name = f"couverture.{extension}"
    return cover


def check_book_file(file):
    """Valide le fichier d'un livre ; son extension devient celle du format détecté."""
    _check_size(file, MAX_BOOK_SIZE)
    file.name = f"livre.{_detect_format(file)}"
    return file


def _check_size(file, limit):
    if file.size > limit:
        megabytes = limit // 1024**2
        raise ValidationError(f"Le fichier dépasse la taille maximale de {megabytes} Mo.")


def _detect_format(file):
    header = file.read(5)
    file.seek(0)
    if header == b"%PDF-":
        _check_pdf(file)
        return Book.Format.PDF
    if _is_epub(file):
        return Book.Format.EPUB
    raise ValidationError("Le fichier doit être un PDF ou un EPUB valide.")


def _check_pdf(file):
    """
    Un PDF doit s'ouvrir sans mot de passe : sa copie filigranée sera générée à chaque achat.

    Le fichier vient de l'extérieur : toute erreur de lecture, quelle qu'elle soit,
    est traitée comme un fichier invalide plutôt que comme une panne du serveur.
    """
    try:
        reader = PdfReader(file)
        if reader.is_encrypted:
            raise ValidationError("Ce PDF est protégé par un mot de passe : retirez la protection.")
        if not reader.pages:
            raise ValidationError("Ce PDF ne contient aucune page.")
    except ValidationError:
        raise
    except Exception as exc:  # noqa: BLE001 - fichier malformé, quelle que soit l'erreur levée
        raise ValidationError("Le fichier PDF est endommagé ou illisible.") from exc
    finally:
        file.seek(0)


def _is_epub(file):
    """Un EPUB est une archive ZIP dont l'entrée `mimetype` vaut `application/epub+zip`."""
    try:
        with zipfile.ZipFile(file) as archive:
            mimetype = archive.getinfo("mimetype")
            # La taille est vérifiée avant lecture pour ne pas décompresser une entrée piégée.
            return (
                mimetype.file_size < 64
                and archive.read(mimetype).strip() == b"application/epub+zip"
            )
    except Exception:  # noqa: BLE001 - archive malformée, quelle que soit l'erreur levée
        return False
    finally:
        file.seek(0)
