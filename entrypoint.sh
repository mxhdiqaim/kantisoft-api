#!/bin/sh

# This is a "wait-for-it" pattern to ensure the database is ready
echo "Waiting for the database to be ready..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready. Running migrations and seeds..."

# Run database generation
pnpm run generate

# Run database migrations
pnpm run migrate

## Run database seeds
#pnpm run seed

# Finally, run the main application command
echo "Migrations and seeds complete. Starting the API server..."
pnpm run dev