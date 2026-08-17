# Sptinder - Spotify Music Tinder

A music discovery app that lets users swipe through tracks from Spotify, keeping the ones they like which are synced to a playlist in their account.

## 🎵 Features

- **Spotify Integration**: OAuth 2.0 PKCE authentication with transparent token refresh
- **Swipe Discovery**: Tinder-like interface for discovering new music
- **Playlist Sync**: Kept tracks are automatically synced to a Spotify playlist
- **Swipe History**: View all swiped tracks with filter by direction
- **Undo Swipe**: Remove accidental swipes

## 🏗️ Architecture

### Single EC2 Architecture (Single Instance - No HA)

- **EC2 Instance**: t3.small running Docker Compose with Postgres container
- **ALB**: Application Load Balancer terminating TLS
- **Containerized Services**: API (Fastify) and Web (nginx)

### Technology Stack

- **Backend**: Node.js 22, Fastify, TypeScript, Zod for validation
- **Database**: PostgreSQL 16 with Drizzle ORM
- **Auth**: Spotify OAuth 2.0 Authorization Code with PKCE + JWT cookies
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Infrastructure**: Terraform, AWS EC2, S3 for state
- **CI**: GitHub Actions

## ⚠️ Important: Single Instance Setup

This infrastructure uses a **single t3.small EC2 instance** with:
- Postgres running as a container (not RDS)
- No automatic failover or replication
- Nightly pg_dump to S3 for backups

**Moving to RDS would require:**
1. `terraform -chdir=infra apply -replace=module.database`
2. Update `DATABASE_URL` environment variable to RDS endpoint
3. Run migrations and data migration

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 22
- Spotify Developer Account

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/sptinder.git
   cd sptinder
   ```

2. **Set up Spotify App**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Add `http://localhost:3000/auth/callback` to redirect URIs
   - Copy Client ID and Client Secret

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Start Development Environment**
   ```bash
   npm run dev
   ```

5. **Access the Application**
   - Frontend: http://localhost:3001
   - API: http://localhost:3000

### Production Deployment

1. **Set up Terraform backend**
   ```bash
   # Create S3 bucket and DynamoDB table for state
   aws s3 mb s3://sptinder-terraform-state
   aws dynamodb create-table --table-name sptinder-terraform-locks --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH
   ```

2. **Deploy infrastructure**
   ```bash
   cd infra
   terraform init
   terraform apply
   ```

3. **Build and push images**
   ```bash
   # Images are built and pushed automatically via GitHub Actions
   # Or manually:
   docker build -f apps/api/Dockerfile -t <ecr-url>/sptinder-api:latest .
   docker build -f apps/web/Dockerfile -t <ecr-url>/sptinder-web:latest .
   ```

## 📁 Project Structure

```
sptinder/
├── apps/
│   ├── api/                 # Fastify API with Drizzle ORM
│   └── web/                 # React + Vite frontend
├── infra/                   # Terraform modules
│   ├── modules/
│   │   ├── vpc/             # VPC with public/private subnets
│   │   ├── ec2/             # EC2 instance with SSM access
│   │   ├── alb/             # Application Load Balancer
│   │   ├── database/        # EBS volume for Postgres
│   │   ├── ecr/             # Container registries
│   │   └── secrets/         # SSM Parameter Store
│   └── main.tf              # Root configuration
├── docker-compose.yml       # Local development
└── .github/workflows/       # CI/CD pipelines
```

## 📝 API Endpoints

### Auth
```
GET  /api/auth/login         # Spotify OAuth login (PKCE)
POST /api/auth/callback      # OAuth callback
GET  /api/auth/me            # Get current user
```

### Tracks
```
GET  /api/tracks/next        # Get next track for swiping
```

### Swipes
```
POST   /api/swipes           # Record a swipe { trackId, direction }
DELETE /api/swipes/last      # Undo last swipe
GET    /api/swipes/history   # Get swipe history (optional filter: direction)
```

### Playlists
```
POST /api/playlists/sync     # Sync kept tracks to Spotify playlist
```

## 🔧 Configuration

### Environment Variables

```bash
# Spotify API
SPOTIFY_CLIENT_ID=          # From Spotify Developer Dashboard
SPOTIFY_CLIENT_SECRET=      # From Spotify Developer Dashboard

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/sptinder

# Security
JWT_SECRET=                 # Minimum 32 characters
ENCRYPTION_KEY=             # Exactly 32 characters for AES-256-GCM

# Server
PORT=3000
NODE_ENV=development
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run API tests
npm run test:api

# Run web tests
npm run test:web
```

## 🔒 Security

- JWT in httpOnly, SameSite=Lax cookie
- Refresh tokens encrypted at rest with AES-256-GCM
- PKCE flow for OAuth (no client secret in browser)
- Server-side token refresh

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License