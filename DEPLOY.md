# Free Tier Deployment Guide

## Quick Deploy with Render.com (Free tier available)

### 1. Create PostgreSQL Database
```bash
# Sign up at https://render.com and create a PostgreSQL database
# Or use Neon.tech free tier: https://neon.tech
# Get the connection string (format: postgresql://user:pass@host:5432/db)
```

### 2. Get Secrets
```bash
# JWT Secret (32+ chars):
openssl rand -base64 32

# Encryption Key (exactly 32 chars):
openssl rand -base64 24 | head -c 32
```

### 3. Deploy to Render
```bash
# Install render CLI
npm install -g @render-oss/cli

# Login
render login

# Deploy API
render service create \
  --name sptinder-api \
  --type web \
  --env NODE_ENV=production \
  --env SPOTIFY_CLIENT_ID=08bb68f750b84bee90a3327e147d8dca \
  --env SPOTIFY_CLIENT_SECRET=<your_client_secret> \
  --env JWT_SECRET=<jwt_secret> \
  --env ENCRYPTION_KEY=<encryption_key> \
  --env DATABASE_URL=<postgres_url> \
  --build-command "cd apps/api && npm install && npm run build" \
  --start-command "cd apps/api && npm start"

# Deploy Web (static site)
render service create \
  --name sptinder-web \
  --type static \
  --env NODE_ENV=production \
  --build-command "cd apps/web && npm install && npm run build" \
  --publish-path "apps/web/dist"
```

## Alternative: Fly.io Deployment

### 1. Install Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"
```

### 2. Create app
```bash
fly launch --name sptinder-api
# Select "Use an existing Dockerfile" -> apps/api/Dockerfile
# When asked about PostgreSQL, select "I'll add my own database"
```

### 3. Set secrets
```bash
fly secrets set SPOTIFY_CLIENT_ID=08bb68f750b84bee90a3327e147d8dca
fly secrets set SPOTIFY_CLIENT_SECRET=<your_client_secret>
fly secrets set JWT_SECRET=$(openssl rand -base64 32)
fly secrets set ENCRYPTION_KEY=$(openssl rand -base64 24 | head -c 32)
fly secrets set DATABASE_URL=<your_neon_postgres_url>
```

### 4. Deploy
```bash
fly deploy
```

## After Deployment

Update your Spotify app's redirect URI to match your deployed URL:
- `https://sptinder-api.fly.dev/auth/callback` (for Fly)
- `https://sptinder-api.onrender.com/auth/callback` (for Render)

Then access the web app at:
- `https://sptinder-web.fly.dev` (for Fly) or your Render static site URL

## Local Testing (if you want to test first)

### Option A: With Docker
```bash
# Start PostgreSQL container
docker run -d --name sptinder-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:16

# Update .env DATABASE_URL to postgresql://postgres:password@localhost:5432/postgres

# Start API
cd apps/api && npm run dev

# Start Web (in another terminal)
cd apps/web && npm run dev
```

### Option B: With Neon.tech (no Docker)
```bash
# Sign up at neon.tech, create database, copy connection string
# Update .env with the connection string
# Run: cd apps/api && npm run dev
```