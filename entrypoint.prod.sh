#!/bin/sh

# Check if required environment variables are set
if [ -z "$DB_CONNECTION_STRING" ]; then
  echo "Error: DB_CONNECTION_STRING environment variable is not set."
  exit 1
fi

if [ -z "$REDIS_HOST" ] || [ -z "$REDIS_PORT" ]; then
  echo "Error: REDIS_HOST or REDIS_PORT environment variables are not set."
  exit 1
fi


echo "Waiting for the database..."

# Use the connection string for the readiness check
until pg_isready -d "$DB_CONNECTION_STRING"; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Postgres is ready."


# REDIS WAIT
echo "Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."
# Netcat (nc) check if a TCP connection is possible
# Note: This checks port access, not authentication. The API client must handle auth.
until nc -z "$REDIS_HOST" "$REDIS_PORT"; do
  echo "Redis is unavailable - sleeping"
  sleep 1
done
echo "Redis is ready."

echo "All services are ready. Running migrations..."

# Run database migrations using the compiled JavaScript file
pnpm run migrate:prod

echo "Migrations complete. Seeding data..."

# Run database seeds
pnpm run seed:prod

echo "Seeding complete. Starting the API server..."

# Use exec to ensure the 'pnpm start' process keeps the container alive
exec pnpm start