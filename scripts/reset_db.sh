#!/bin/bash
set -e

echo "⚠️  WARNING: This will DROP and recreate the database!"
echo "All data will be permanently lost."
echo ""
read -p "Are you sure? Type 'yes' to continue: " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

COMPOSE=${COMPOSE:-docker-compose}

echo "Dropping database..."
$COMPOSE exec postgres psql -U studybuddy -c "DROP DATABASE IF EXISTS studybuddy;"
$COMPOSE exec postgres psql -U studybuddy -c "CREATE DATABASE studybuddy;"

echo "Running migrations..."
$COMPOSE exec backend alembic upgrade head

echo "✅ Database reset complete."
