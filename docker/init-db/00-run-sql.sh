#!/bin/sh
# Aplica el esquema base y las migraciones, en orden, dentro de la base de
# datos que ya crea el propio contenedor de Postgres (POSTGRES_DB). Se filtra
# la sentencia "CREATE DATABASE" de database.sql porque la base ya existe.
set -e

for f in /docker-entrypoint-initdb.d/sql/*.sql; do
  echo "Aplicando $f"
  grep -v '^CREATE DATABASE' "$f" | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"
done
