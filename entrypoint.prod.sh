#!/bin/sh

echo "Waiting for the database to be ready..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready. Running migrations..."

pnpm run migrate:prod

echo "Migrations complete. Starting the API server..."

exec pnpm start