#!/bin/sh

# Use the variables that SHOULD be defined in the Docker Compose API environment block
DB_USER_FINAL=$DB_USER
DB_HOST_FINAL=$DB_HOST
DB_PORT_FINAL=$DB_PORT

# Check if required environment variables are set
# Check the host and user/port which are needed for connection
if [ -z "$DB_HOST_FINAL" ] || [ -z "$DB_PORT_FINAL" ] || [ -z "$DB_USER_FINAL" ]; then
  echo "Error: DB_HOST, DB_PORT, or DB_USER environment variables are not set."
  exit 1
fi

if [ -z "$REDIS_HOST" ] || [ -z "$REDIS_PORT" ]; then
  echo "Error: REDIS_HOST or REDIS_PORT environment variables are not set."
  exit 1
fi

# The DB_PASSWORD_FILE_PATH is defined by Docker Secrets: /run/secrets/db_password_file
if [ -z "$DB_PASSWORD_FILE_PATH" ]; then
  echo "Error: DB_PASSWORD_FILE_PATH environment variable is not set."
  exit 1
fi

echo "Waiting for the database at $DB_HOST_FINAL:$DB_PORT_FINAL..."

# Use the secret file content for the password during the readiness check
export PGPASSWORD=$(cat "$DB_PASSWORD_FILE_PATH")

until pg_isready -h "$DB_HOST_FINAL" -p "$DB_PORT_FINAL" -U "$DB_USER_FINAL"; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

# Clear the PGPASSWORD environment variable immediately after the check for security
unset PGPASSWORD

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