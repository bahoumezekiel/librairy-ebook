"""Configuration de recherche française insensible aux accents (« securite » trouve « sécurité »)."""

from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        UnaccentExtension(),
        migrations.RunSQL(
            sql=[
                "CREATE TEXT SEARCH CONFIGURATION french_unaccent (COPY = french)",
                "ALTER TEXT SEARCH CONFIGURATION french_unaccent "
                "ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem",
            ],
            reverse_sql="DROP TEXT SEARCH CONFIGURATION french_unaccent",
        ),
    ]
