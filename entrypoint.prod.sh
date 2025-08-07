#!/bin/sh

# Check if the DATABASE_URL environment variable is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set."
  exit 1
fi

# Extract components from the DATABASE_URL
# The following command uses standard shell tools to parse the URL
DB_HOST=$(echo "$DATABASE_URL" | awk -F'[@:/]' '{print $4}')
DB_PORT=$(echo "$DATABASE_URL" | awk -F'[@:/]' '{print $5}')
DB_USER=$(echo "$DATABASE_URL" | awk -F'[@:/]' '{print $3}')

#echo "Waiting for the database to be ready..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready. Running migrations..."

pnpm run migrate:prod

echo "Migrations complete. Starting the API server..."

exec pnpm start