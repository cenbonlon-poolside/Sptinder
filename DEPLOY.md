# Deploy Sptinder to Render.com (Free tier)

## ✅ All code is ready - just follow these steps:

### Step 1: Push to GitHub
```bash
git push origin main
```

### Step 2: Deploy API on Render

**New Web Service:**
- Name: `sptinder-api`
- Root Directory: `apps/api`
- Build Command: `npm install && npm run build`
- Start Command: `node dist/index.js`

**Environment Variables:**
```
SPOTIFY_CLIENT_ID = 08bb68f750b84bee90a3327e147d8dca
SPOTIFY_CLIENT_SECRET = 8aae39d92fa4475dbf1126dd6147c7a5
JWT_SECRET = Wz3xQ9KmNp2RvT8YhB4fLdJ6sA1cE5gI
ENCRYPTION_KEY = 3hLjWqZ6tvMLXGTNaCeyKEXFk27yoNyM
PORT = 10000
NODE_ENV = production
REDIRECT_URI = https://sptinder-api.onrender.com/auth/callback
```

### Step 3: Add PostgreSQL Database

- "New +" → "PostgreSQL"
- Copy connection string to `DATABASE_URL` in your API service

### Step 4: Deploy Web Frontend

- "New +" → "Static Site"
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

Visit https://sptinder-web.onrender.com to start swiping on music!