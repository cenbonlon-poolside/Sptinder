# Deploy Sptinder to Render.com (Free tier)

## ✅ All code is ready - just follow these steps:

### Step 1: Code is already pushed ✓
Repository: https://github.com/cenbonlon-poolside/Sptinder

### Step 2: Deploy API (Backend) on Render

**Create New Web Service:**
1. Go to https://dashboard.render.com → "New +" → "Web Service"
2. Select your GitHub repo `cenbonlon-poolside/Sptinder`

**Configure:**
- Language: **Node**
- Region: **Ohio (US East)** (or closest)
- Branch: **main**
- Root Directory: **`apps/api`**
- Build Command: `npm install && npm run build`
- Start Command: `node dist/index.js`
- Instance Type: **Free** ($0/month)

### Step 3: Add PostgreSQL Database

1. In Render dashboard, click **"New +" → "PostgreSQL"**
2. Name: `sptinder-db`
3. After creation, copy the connection string to `DATABASE_URL` in your API service

### Step 4: Set Environment Variables

In your API service settings, add these variables:
```
SPOTIFY_CLIENT_ID = 08bb68f750b84bee90a3327e147d8dca
SPOTIFY_CLIENT_SECRET = 8aae39d92fa4475dbf1126dd6147c7a5
JWT_SECRET = Wz3xQ9KmNp2RvT8YhB4fLdJ6sA1cE5gI
ENCRYPTION_KEY = 3hLjWqZ6tvMLXGTNaCeyKEXFk27yoNyM
PORT = 10000
NODE_ENV = production
REDIRECT_URI = https://<your-api-name>.onrender.com/auth/callback
```

Replace `<your-api-name>` with the actual service name (e.g., `sptinder-api`)

### Step 5: Deploy Web Frontend

1. **"New +" → "Static Site"**
2. Select your repo
3. Configure:
   - Name: `sptinder-web`
   - Root Directory: `apps/web`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

### Step 6: Update Spotify Redirect URI

In Spotify Developer Dashboard:
```
https://<your-api-name>.onrender.com/auth/callback
```

## Done!

Your app will be live at: **https://sptinder-web.onrender.com**

Note: The API will be at `https://<api-name>.onrender.com`