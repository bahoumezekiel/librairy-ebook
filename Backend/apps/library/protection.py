"""
Protection des livres payants : filigrane nominatif et chiffrement.

Format du fichier chiffré, lu tel quel par l'API Web Crypto du navigateur :
`nonce (12 octets) || texte chiffré || étiquette d'authentification GCM (16 octets)`.
"""

import os
from io import BytesIO

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

NONCE_SIZE = 12
FOOTER_FONT = ("Helvetica", 8)
FOOTER_HEIGHT = 14  # distance au bas de la page, en points


def watermark_pdf(content, text):
    """Inscrit `text` au bas de chaque page du PDF et renvoie le nouveau fichier."""
    writer = PdfWriter(clone_from=BytesIO(content))
    footers = {}  # un seul pied de page généré par format de page
    for page in writer.pages:
        size = (float(page.mediabox.width), float(page.mediabox.height))
        if size not in footers:
            footers[size] = _footer_page(text, size)
        page.merge_page(footers[size])
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def _footer_page(text, size):
    """Page transparente ne contenant que le texte du filigrane, centré en bas."""
    buffer = BytesIO()
    footer = canvas.Canvas(buffer, pagesize=size)
    footer.setFont(*FOOTER_FONT)
    footer.setFillGray(0.4)
    footer.drawCentredString(size[0] / 2, FOOTER_HEIGHT, text)
    footer.save()
    return PdfReader(buffer).pages[0]


def encrypt(content):
    """Chiffre `content` en AES-256-GCM avec une clé neuve. Renvoie `(clé, fichier chiffré)`."""
    key = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(NONCE_SIZE)
    return key, nonce + AESGCM(key).encrypt(nonce, content, None)
