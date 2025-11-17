#!/bin/sh

# This is a "wait-for-it" pattern to ensure the database is ready
echo "Waiting for the database to be ready..."
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER";
do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready."

echo "Waiting for Redis to be ready..."

# WAIT FOR REDIS
#until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping | grep PONG;
#until nc -z redis_cache 6379;
until nc -z "$REDIS_HOST" "$REDIS_PORT";
do
  echo "Redis at $REDIS_HOST:$REDIS_PORT - still waiting"
  sleep 1
done

echo "Redis is ready."

echo "Running database migrations..."

# Run database migrations
pnpm run migrate

## Run database seeds
#pnpm run seed

echo "Migrations complete. Starting the API server..."

exec pnpm run dev