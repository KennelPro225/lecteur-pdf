#!/bin/sh
set -e

echo "=== Démarrage de Folio PDF Reader (DB_PROVIDER=${DB_PROVIDER:-sqlite}) ==="

mkdir -p /app/uploads /app/prisma

if [ "${DB_PROVIDER:-sqlite}" != "json" ]; then
  echo "Synchronisation du schéma de base de données via Prisma..."
  npx prisma db push --skip-generate
fi

exec "$@"
