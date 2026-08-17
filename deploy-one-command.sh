# One-command deployment script for Sptinder
# Install flyctl first: curl -L https://fly.io/install.sh | sh

#!/bin/bash
set -e

# Configuration - pre-filled
APP_NAME="sptinder-api"
SPOTIFY_CLIENT_ID="08bb68f750b84bee90a3327e147d8dca"
SPOTIFY_CLIENT_SECRET="8aae39d92fa4475dbf1126dd6147c7a5"

echo "=== Sptinder Deployment ==="

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 24 | head -c 32)

echo "Generated secrets:"
echo "JWT_SECRET: ${JWT_SECRET:0:16}..."
echo "ENCRYPTION_KEY: ${ENCRYPTION_KEY:0:16}..."

# Create Fly app
flyctl apps list 2>/dev/null | grep -q "$APP_NAME" || flyctl launch --name "$APP_NAME" --region iad --image dummy --no-deploy

# Attach PostgreSQL
flyctl postgres attach --app "$APP_NAME" 2>/dev/null || true

# Set secrets
flyctl secrets set \
  SPOTIFY_CLIENT_ID="$SPOTIFY_CLIENT_ID" \
  SPOTIFY_CLIENT_SECRET="$SPOTIFY_CLIENT_SECRET" \
  JWT_SECRET="$JWT_SECRET" \
  ENCRYPTION_KEY="$ENCRYPTION_KEY"

echo "Secrets configured"

# Deploy
flyctl deploy --app "$APP_NAME" --remote-only

echo ""
echo "=== Deployment Complete ==="
flyctl info --app "$APP_NAME" 2>/dev/null | grep -E "Hostname|Region" || true
echo ""
echo "Next step: Update Spotify redirect URI to https://$APP_NAME.fly.dev/auth/callback"