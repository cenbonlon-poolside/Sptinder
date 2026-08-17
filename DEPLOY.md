# Deploy Sptinder - 3 Steps

## Step 1: Get PostgreSQL (Free)

Go to https://neon.tech and sign up. Create a database and copy the connection string.

## Step 2: Deploy to Render

Go to https://render.com and:

1. Click **"New Web Service"**
2. Connect your GitHub repo
3. Set:
   - **Name**: sptinder-api
   - **Root Directory**: apps/api
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/index.js`

4. Add environment variables:
```
SPOTIFY_CLIENT_ID=08bb68f750b84bee90a3327e147d8dca
SPOTIFY_CLIENT_SECRET=8aae39d92fa4475dbf1126dd6147c7a5
JWT_SECRET=Wz3xQ9KmNp2RvT8YhB4fLdJ6sA1cE5gI
ENCRYPTION_KEY=3hLjWqZ6tvMLXGTNaCeyKEXFk27yoNyM
PORT=3000
DATABASE_URL=<paste-neon-connection-string-here>
```

## Step 3: Update Spotify Settings

In your Spotify developer dashboard, set redirect URI to:
```
https://sptinder-api.onrender.com/auth/callback
```

## Done!

Visit https://sptinder-api.onrender.com in your browser.

---

## Quick Secrets (already generated above)

- JWT_SECRET: `Wz3xQ9KmNp2RvT8YhB4fLdJ6sA1cE5gI`
- ENCRYPTION_KEY: `3hLjWqZ6tvMLXGTNaCeyKEXFk27yoNyM`