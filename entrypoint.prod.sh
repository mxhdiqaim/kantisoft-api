#!/bin/sh

# Check if required environment variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ]; then
  echo "Error: DB_HOST, DB_PORT, or DB_USER environment variables are not set."
  exit 1
fi

echo "Waiting for the database at $DB_HOST:$DB_PORT..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

# REDIS WAIT
echo "Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."
# Netcat (nc) check if a TCP connection is possible
until nc -z "$REDIS_HOST" "$REDIS_PORT"; do
  echo "Redis is unavailable - sleeping"
  sleep 1
done
echo "Redis is ready."

echo "All services are ready. Running migrations..."

# Run database migrations using the compiled JavaScript file
pnpm run migrate:prod

echo "Migrations complete. Starting the API server..."

# Use exec to ensure the 'pnpm start' process keeps the container alive
exec pnpm start