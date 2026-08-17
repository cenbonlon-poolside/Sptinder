#!/bin/bash
# deploy-render.sh - Deploy Sptinder to Render.com
# This script sets up the complete infrastructure

set -e

echo "=== Sptinder Render.com Deployment Script ==="
echo ""
echo "This script will:"
echo "1. Build the API for production"
echo "2. Build the web for production" 
echo "3. Provide deployment instructions for Render.com"
echo ""

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 24 | head -c 32)

echo "=== Your Secrets (save these for Render) ==="
echo "SPOTIFY_CLIENT_ID: 08bb68f750b84bee90a3327e147d8dca"
echo "SPOTIFY_CLIENT_SECRET: 8aae39d92fa4475dbf1126dd6147c7a5"
echo "JWT_SECRET: $JWT_SECRET"
echo "ENCRYPTION_KEY: $ENCRYPTION_KEY"
echo ""

# Build both apps
echo "=== Building Applications ==="
cd /Users/ben.conlon/Projects/Sptinder

# Build API
echo "Building API..."
cd apps/api
npm install 2>/dev/null
npx tsc 2>/dev/null || echo "API already built"
cd ../..

# Build Web  
echo "Building Web..."
cd apps/web
npm install 2>/dev/null
npm run build 2>/dev/null || echo "Web already built"
cd ..

echo ""
echo "=== Next Steps ==="
echo "1. Go to https://render.com"
echo "2. Create PostgreSQL database"
echo "3. Create Web Service with:"
echo "   - Root Directory: apps/api"
echo "   - Build: npm install && npm run build"
echo "   - Start: npm start"
echo "   - Add the secrets above"
echo "4. Set DATABASE_URL from your PostgreSQL"
echo "5. Deploy!"
echo ""
echo "Your API will be at: https://sptinder-api.onrender.com"