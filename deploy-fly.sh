#!/bin/bash
# deploy-fly.sh - Deploy Sptinder to Fly.io

set -e

echo "=== Deploying Sptinder to Fly.io ==="
echo ""

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 24 | head -c 32)

echo "Generated secrets:"
echo "JWT_SECRET: $JWT_SECRET"
echo "ENCRYPTION_KEY: $ENCRYPTION_KEY"
echo ""

# Get Spotify Client Secret
echo "Please enter your Spotify Client Secret (from https://developer.spotify.com/dashboard):"
read -s SPOTIFY_CLIENT_SECRET
echo ""

# Set secrets in Fly
flyctl secrets set SPOTIFY_CLIENT_ID=08bb68f750b84bee90a3327e147d8dca \
  SPOTIFY_CLIENT_SECRET="$SPOTIFY_CLIENT_SECRET" \
  JWT_SECRET="$JWT_SECRET" \
  ENCRYPTION_KEY="$ENCRYPTION_KEY"

echo "Deployment ready!"
echo ""
echo "Next steps:"
echo "1. Get a PostgreSQL database (Fly Postgres or Neon.tech)"
echo "2. Set DATABASE_URL secret: flyctl secrets set DATABASE_URL=<your_postgres_url>"
echo "3. Deploy: flyctl deploy"
echo "4. Update Spotify redirect URI to https://sptinder-api.fly.dev/auth/callback"