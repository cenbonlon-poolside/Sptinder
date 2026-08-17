# Deploy Sptinder to Render.com (Free tier)

## ✅ Automatic Deployment with render.yaml

**Repository:** https://github.com/cenbonlon-poolside/Sptinder

The `render.yaml` file is already in the repo and will auto-configure both services.

### Step 1: Deploy from render.yaml

1. Go to https://dashboard.render.com → "New +" → "Blueprint"
2. Connect your GitHub account
3. Select `cenbonlon-poolside/Sptinder`
4. Render will auto-detect `render.yaml` and propose both services

### Step 2: Add PostgreSQL Database

1. Click **"New +" → "PostgreSQL"**
2. Name: `sptinder-db`
3. Region: Ohio
4. Plan: Free

### Step 3: Connect Database to API

1. Go to your `sptinder-api` service → Environment
2. Add variable: `DATABASE_URL` = (paste the connection string from PostgreSQL)
3. Redeploy the service

### Step 4: Update Spotify Redirect URI

In Spotify Developer Dashboard:
```
https://sptinder-api.onrender.com/auth/callback
```

### Done!

Your app will be available at:
- **Frontend:** https://sptinder-web.onrender.com
- **API:** https://sptinder-api.onrender.com

Click "Login with Spotify" and start swiping!