# Deploy Sptinder to Render.com (Free tier)

## ✅ Two-Step Deployment

**Repository:** https://github.com/cenbonlon-poolside/Sptinder

### Step 1: Deploy API via Blueprint

1. Go to https://dashboard.render.com → "New +" → "Blueprint"
2. Select `cenbonlon-poolside/Sptinder`
3. Deploy the `sptinder-api` service (defined in `render.yaml`)

### Step 2: Add Secrets to API Service

In `sptinder-api` → Environment, add:
```
SPOTIFY_CLIENT_ID = 08bb68f750b84bee90a3327e147d8dca
SPOTIFY_CLIENT_SECRET = 8aae39d92fa4475dbf1126dd6147c7a5
JWT_SECRET = Wz3xQ9KmNp2RvT8YhB4fLdJ6sA1cE5gI
ENCRYPTION_KEY = 3hLjWqZ6tvMLXGTNaCeyKEXFk27yoNyM
```

### Step 3: Add PostgreSQL Database

1. Click **"New +" → "PostgreSQL"**
2. Name: `sptinder-db`, Region: Ohio, Plan: Free
3. Copy connection string to `DATABASE_URL` in `sptinder-api`

### Step 4: Deploy Web Frontend (Static Site)

1. Click **"New +" → "Static Site"**
2. Repository: `cenbonlon-poolside/Sptinder`
3. Configure:
   - Name: `sptinder-web`
   - Root Directory: `apps/web`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

### Step 5: Update Spotify Redirect URI

In Spotify Developer Dashboard:
```
https://sptinder-api.onrender.com/auth/callback
```

## Done!

Your app will be at:
- **Frontend:** https://sptinder-web.onrender.com
- **API:** https://sptinder-api.onrender.com