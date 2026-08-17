#!/bin/bash

# Sptinder Setup Script
echo "🎵 Setting up Sptinder - Spotify Music Tinder"
echo "=============================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it with your Spotify credentials."
    echo "   Copy the template from above and fill in your values."
    exit 1
fi

# Check if required environment variables are set
if ! grep -q "SPOTIFY_CLIENT_ID=your_spotify_client_id_here" .env; then
    echo "✅ Spotify credentials appear to be configured"
else
    echo "⚠️  Please edit .env file with your actual Spotify Client ID and Secret"
    echo "   Get them from: https://developer.spotify.com/dashboard"
fi

echo "🚀 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "📊 Checking service health..."
docker-compose ps

echo ""
echo "🎉 Setup complete!"
echo "=================="
echo "Access your application:"
echo "• Frontend: http://localhost:3000"
echo "• API Health: http://localhost:4000/health"
echo "• Prometheus: http://localhost:9090"
echo "• Grafana: http://localhost:3001 (admin/admin)"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"