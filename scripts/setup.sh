#!/bin/bash
set -e

echo "🚀 AI Study Buddy — First-time Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check prerequisites
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
    echo "✅ $1 found"
}

echo ""
echo "Checking prerequisites..."
check_command docker
check_command git

# Check docker compose (v2)
if docker compose version &> /dev/null 2>&1; then
    COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE="docker-compose"
else
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi
echo "✅ docker-compose found"

# Copy .env.example to .env if not exists
if [ ! -f ".env" ]; then
    echo ""
    echo "Creating .env file from .env.example..."
    cp .env.example .env

    # Generate a random SECRET_KEY
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))" 2>/dev/null || \
                 openssl rand -base64 48 | tr -d '\n')
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/change-this-to-a-very-long-random-secret-key-in-production/$SECRET_KEY/" .env
    else
        sed -i "s/change-this-to-a-very-long-random-secret-key-in-production/$SECRET_KEY/" .env
    fi
    
    echo "✅ .env created with random SECRET_KEY"
    echo "⚠️  Please edit .env and add your LLM API keys (OPENAI_API_KEY, etc.)"
else
    echo "✅ .env already exists"
fi

echo ""
echo "Building Docker images..."
$COMPOSE build

echo ""
echo "Starting services..."
$COMPOSE up -d postgres chromadb redis

echo ""
echo "Waiting for database to be ready..."
sleep 10

echo "Running database migrations..."
$COMPOSE up -d backend
sleep 15
$COMPOSE exec backend alembic upgrade head

echo ""
echo "Starting all services..."
$COMPOSE up -d

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ AI Study Buddy is ready!"
echo ""
echo "  Frontend:    http://localhost"
echo "  API:         http://localhost:8000"
echo "  API Docs:    http://localhost:8000/docs"
echo ""
echo "To seed sample data:  $COMPOSE exec backend python scripts/seed_data.py"
echo "To view logs:         $COMPOSE logs -f"
echo "To stop:              $COMPOSE down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
