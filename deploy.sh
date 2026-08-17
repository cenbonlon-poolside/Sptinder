# deploy.sh - Deploy Sptinder to the cloud

set -e

echo "=== Sptinder Deployment Script ==="
echo ""

# Check for required tools
if ! command -v git &> /dev/null; then
  echo "Error: git is required"
  exit 1
fi

echo "This script will help you deploy Sptinder to a cloud provider."
echo ""
echo "Prerequisites:"
echo "1. Spotify app with redirect URI configured"
echo "2. Cloud PostgreSQL database URL"
echo "3. AWS/Docker account for deployment"
echo ""
echo "Deployment options:"
echo "1. Fly.io (simplest, \$5/month free tier)"
echo "2. Render.com (simplest, free tier available)"
echo "3. AWS via Terraform (most complex, single EC2)"
echo ""
echo "Running option 1 (Fly.io)..."

# Install flyctl if not present
if ! command -v flyctl &> /dev/null; then
  echo "Installing flyctl..."
  curl -L https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
fi

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 24 | head -c 32)

echo "Generated secrets:"
echo "  JWT_SECRET: ${JWT_SECRET:0:8}... (32+ chars)"
echo "  ENCRYPTION_KEY: ${ENCRYPTION_KEY:0:8}... (exactly 32 chars)"
echo ""

echo "To deploy with Fly.io, run:"
echo "  fly launch --name sptinder-api"
echo "  fly secrets set SPOTIFY_CLIENT_ID=08bb68f750b84bee90a3327e147d8dca"
echo "  fly secrets set SPOTIFY_CLIENT_SECRET=<your_client_secret>"
echo "  fly secrets set JWT_SECRET='$JWT_SECRET'"
echo "  fly secrets set ENCRYPTION_KEY='$ENCRYPTION_KEY'"
echo "  fly secrets set DATABASE_URL=<your_postgres_url>"
echo ""
echo "Or copy the values manually from the git diff below:"
git diff .env 2>/dev/null || echo "No .env changes to show"