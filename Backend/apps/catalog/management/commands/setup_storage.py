"""Crée les espaces de stockage et ouvre celui des couvertures en lecture publique."""

import json

from botocore.exceptions import ClientError
from django.core.files.storage import storages
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Crée les espaces de stockage S3 (privé et public) s'ils n'existent pas."

    def handle(self, *args, **options):
        for alias in ("default", "public"):
            storage = storages[alias]
            client, bucket = storage.connection.meta.client, storage.bucket_name
            try:
                client.head_bucket(Bucket=bucket)
            except ClientError:
                client.create_bucket(Bucket=bucket)
            if alias == "public":
                client.put_bucket_policy(Bucket=bucket, Policy=json.dumps(_read_policy(bucket)))
            self.stdout.write(self.style.SUCCESS(f"Espace « {bucket} » prêt."))


def _read_policy(bucket):
    """Politique autorisant tout le monde à lire les fichiers de l'espace, sans les lister."""
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": f"arn:aws:s3:::{bucket}/*",
            }
        ],
    }
