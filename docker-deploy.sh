#!/bin/bash

# Docker Deployment Script for Shopify App
# Usage: ./docker-deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-production}
DOMAIN="shopconnect.mygstbill.com"

echo "🚀 Starting Docker deployment for $ENVIRONMENT environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed successfully"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed successfully"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p ssl
mkdir -p data/postgres

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Creating template..."
    cat > .env << EOF
# Shopify App Configuration
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SCOPES=write_products,read_customers,write_orders
HOST=https://$DOMAIN

# Database Configuration
DATABASE_URL=postgresql://postgres:password@db:5432/shopify_app

# Environment
NODE_ENV=$ENVIRONMENT
PORT=3000

# Session Storage
SESSION_SECRET=your_session_secret_here

# Webhook Configuration
WEBHOOK_SECRET=your_webhook_secret_here
EOF
    echo "⚠️  Please update the .env file with your actual values before continuing"
    exit 1
fi

# Generate SSL certificates if they don't exist
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    echo "🔐 Generating SSL certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=IN/ST=State/L=City/O=Organization/CN=$DOMAIN"
    echo "✅ SSL certificates generated"
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans || true

# Pull latest images
echo "📥 Pulling latest images..."
docker-compose pull

# Build and start containers
echo "🏗️  Building and starting containers..."
docker-compose up -d --build

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose exec app npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
docker-compose exec app npx prisma generate

# Check container status
echo "📊 Checking container status..."
docker-compose ps

# Test the application
echo "🧪 Testing application health..."
sleep 5
if curl -f -k https://$DOMAIN/health > /dev/null 2>&1; then
    echo "✅ Application is healthy and running!"
else
    echo "⚠️  Application health check failed. Check logs:"
    docker-compose logs app
fi

echo "🎉 Deployment completed!"
echo "📱 Your Shopify app is now running at: https://$DOMAIN"
echo "📊 Monitor logs with: docker-compose logs -f"
echo "🔄 Restart services with: docker-compose restart"
echo "🛑 Stop services with: docker-compose down"