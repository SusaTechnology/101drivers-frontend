#!/bin/sh
set -e

echo "=== 101Drivers Server Starting ==="

# If DB_URL is set, sync Prisma schema to database before starting
if [ -n "$DB_URL" ]; then
  echo "Syncing database schema with prisma db push..."
  npx prisma db push --skip-generate --accept-data-loss 2>&1 || {
    echo "WARNING: prisma db push failed, starting server anyway..."
  }
else
  echo "WARNING: DB_URL not set, skipping database schema sync."
fi

echo "Starting NestJS server..."
exec node ./dist/main.js
