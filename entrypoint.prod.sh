#!/bin/sh

# Check if required environment variables are set
# Check the host and user/port which are needed for connection
if [ -z "$POSTGRES_HOST" ] || [ -z "$POSTGRES_PORT" ] || [ -z "$POSTGRES_USER" ]; then
  echo "Error: POSTGRES_HOST, POSTGRES_PORT, or POSTGRES_USER environment variables are not set."
  exit 1
fi

if [ -z "$REDIS_HOST" ] || [ -z "$REDIS_PORT" ]; then
  echo "Error: REDIS_HOST or REDIS_PORT environment variables are not set."
  exit 1
fi

# The DB_PASSWORD_FILE is defined by Docker Secrets: /run/secrets/db_password_file
if [ -z "$POSTGRES_PASSWORD_FILE" ]; then
  echo "Error: DB_PASSWORD_FILE environment variable is not set."
  exit 1
fi

echo "Waiting for the database at $POSTGRES_HOST:$POSTGRES_PORT..."

# Use the secret file content for the password during the readiness check
export POSTGRES_PASSWORD=$(cat "$POSTGRES_PASSWORD_FILE")

until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

# Clear the POSTGRES_PASSWORD environment variable immediately after the check for security
unset POSTGRES_PASSWORD

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

echo "Migrations complete. Starting the API server..."

# Use exec to ensure the 'pnpm start' process keeps the container alive
exec pnpm start