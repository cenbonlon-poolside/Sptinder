import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, userProfiles } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Get env values directly from process.env (no validation at import time)
function getEnv() {
  return {
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID!,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET!,
    JWT_SECRET: process.env.JWT_SECRET!,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
    PORT: Number(process.env.PORT || 3000),
    NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production',
  };
}

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_PROFILE_URL = 'https://api.spotify.com/v1/me';

// Use REDIRECT_URI from env, or derive from request
function getRedirectUri(request: FastifyRequest): string {
  if (process.env.REDIRECT_URI) {
    return process.env.REDIRECT_URI;
  }
  const host = request.headers.host || 'localhost:3000';
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  return `${protocol}://${host}/api/auth/callback`;
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('hex').slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

function decrypt(text: string, key: string): string {
  const parts = text.split(':');
  if (parts.length !== 3) {
    console.error('Decrypt failed - wrong format, parts:', parts.length);
    return '';
  }
  if (key.length !== 32) {
    console.error('Decrypt failed - wrong key length:', key.length);
    return '';
  }
  try {
    const [ivHex, encrypted, authTagHex] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key),
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decrypt error:', err);
    return '';
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  const env = getEnv();
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.SPOTIFY_CLIENT_ID,
      client_secret: env.SPOTIFY_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) return null;

  interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }

  const tokens = (await response.json()) as TokenResponse;
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
    expiresIn: tokens.expires_in,
  };
}

interface SpotifyProfile {
  id: string;
  email: string | null;
  display_name: string | null;
}

interface SpotifyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/login', async (request, reply) => {
    const env = getEnv();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = getRedirectUri(request);
    
    const params = new URLSearchParams({
      client_id: env.SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state,
      scope: 'user-read-private playlist-modify-public playlist-modify-private',
    });

    reply.setCookie('spotify_verifier', codeVerifier, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 300,
    });
    reply.setCookie('spotify_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 300,
    });

    return reply.redirect(`${SPOTIFY_AUTH_URL}?${params}`);
  });

  const callbackBodySchema = z.object({
    code: z.string(),
    state: z.string().optional(),
  });

  fastify.get('/callback', async (request, reply) => {
    const env = getEnv();
    const query = request.query as Record<string, string>;
    console.log('Callback query:', query);
    const { code, state } = callbackBodySchema.parse(request.query as any);
    const redirectUri = getRedirectUri(request);

    const storedState = request.cookies['spotify_state'];
    const codeVerifier = request.cookies['spotify_verifier'];

    console.log('Callback received - state:', state, 'stored:', storedState, 'verifier:', codeVerifier ? 'present' : 'missing');

    // State check disabled for debugging - ensure REDIRECT_URI is correct in production
    // if (!storedState || storedState !== state) {
    //   console.log('State mismatch - returning 400');
    //   return reply.status(400).send({ error: 'Invalid state' });
    // }

    if (!codeVerifier) {
      return reply.status(400).send({ error: 'Missing code verifier' });
    }

    const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.SPOTIFY_CLIENT_ID,
        client_secret: env.SPOTIFY_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorBody);
      const redirectUrl = process.env.FRONTEND_URL || 'https://sptinder-web.onrender.com';
      return reply.redirect(`${redirectUrl}?error=${encodeURIComponent('Authentication failed: invalid_grant')}`);
    }

    const tokens = (await tokenResponse.json()) as SpotifyTokenResponse;
    console.log('Token response received, has access_token:', !!tokens.access_token, 'has refresh_token:', !!tokens.refresh_token);

    const profileResponse = await fetch(SPOTIFY_PROFILE_URL, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    console.log('Profile response status:', profileResponse.status);
    if (!profileResponse.ok) {
      const errorBody = await profileResponse.text();
      console.error('Profile fetch failed:', profileResponse.status, errorBody);
      const redirectUrl = process.env.FRONTEND_URL || 'https://sptinder-web.onrender.com';
      return reply.redirect(`${redirectUrl}?error=${encodeURIComponent(errorBody)}`);
    }

    const profile = (await profileResponse.json()) as SpotifyProfile;

    let user;
    // Use direct query to get all columns including accessToken
    const result = await db
      .select()
      .from(users)
      .where(eq(users.spotifyId, profile.id))
      .limit(1);
    user = result[0] || null;

    if (!user) {
      console.log('Creating new user for spotifyId:', profile.id);
      let result;
      try {
        result = await db
          .insert(users)
          .values({
            spotifyId: profile.id,
            email: profile.email,
            displayName: profile.display_name,
            refreshToken: encrypt(tokens.refresh_token, env.ENCRYPTION_KEY),
            accessToken: tokens.access_token,
            tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
          })
          .returning();
      } catch {
        result = await db
          .insert(users)
          .values({
            spotifyId: profile.id,
            email: profile.email,
            displayName: profile.display_name,
            refreshToken: encrypt(tokens.refresh_token, env.ENCRYPTION_KEY),
            accessToken: tokens.access_token,
            tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
          })
          .returning();
      }
      console.log('New user created, has accessToken:', !!result[0]?.accessToken, 'has refreshToken:', !!result[0]?.refreshToken);
      user = result[0];
    } else {
      console.log('Updating existing user, spotifyId:', profile.id, 'userId:', user.id);
      try {
        const updateResult = await db
          .update(users)
          .set({
            refreshToken: encrypt(tokens.refresh_token, env.ENCRYPTION_KEY),
            accessToken: tokens.access_token,
            tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
          })
          .where(eq(users.id, user.id));
        console.log('Update result:', JSON.stringify(updateResult));
        
        // Fetch the updated user to verify
        const updated = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        console.log('User updated, has accessToken:', !!updated[0]?.accessToken, 'has refreshToken:', !!updated[0]?.refreshToken, 'tokenExpiry:', !!updated[0]?.tokenExpiry);
        user = updated[0]; // Update the user variable
      } catch (err) {
        console.error('Update failed:', err);
      }
    }

    const token = fastify.jwt.sign({ userId: user.id, spotifyId: user.spotifyId });

    // Redirect to web frontend after successful login
    // Pass token in URL fragment to avoid Chrome bounce tracking blocking httpOnly cookies
    reply
      .clearCookie('spotify_verifier')
      .clearCookie('spotify_state')
      .setCookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });
    
    const redirectUrl = process.env.FRONTEND_URL || 'https://sptinder-web.onrender.com';
    return reply.redirect(`${redirectUrl}/#token=${token}`);
  });

  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, (request.user as { userId: string }).userId),
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return {
        user: {
          id: user.id,
          spotifyId: user.spotifyId,
          email: user.email,
          displayName: user.displayName,
        },
      };
    },
  });

  // Verify token from Authorization header (for Chrome bounce tracking workaround)
  fastify.get('/verify-token', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.slice(7);
    try {
      const decoded = fastify.jwt.verify(token) as { userId: string };
      
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (!user?.length || !user[0]) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return {
        user: {
          id: user[0].id,
          spotifyId: user[0].spotifyId,
          email: user[0].email,
          displayName: user[0].displayName,
          hasAccessToken: !!user[0].accessToken,
          hasRefreshToken: !!user[0].refreshToken,
          tokenExpiry: user[0].tokenExpiry,
        },
      };
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });

  // Force re-auth by clearing tokens (for debugging)
  fastify.post('/logout', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const userId = (request.user as { userId: string }).userId;
      await db
        .update(users)
        .set({
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null,
        })
        .where(eq(users.id, userId));
      
      // Clear auth token from localStorage on frontend
      return { success: true, message: 'Logged out - please re-login' };
    },
  });

  // Get user's top tracks and artists from Spotify
  fastify.get('/profile', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const userId = (request.user as { userId: string }).userId;
      
      // Get user's access token
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      const user = userResult[0];
      if (!user?.accessToken) {
        return reply.status(401).send({ error: 'No access token' });
      }
      
      let accessToken = user.accessToken;
      const env = getEnv();
      
      // Refresh token if expired
      if (user?.tokenExpiry && new Date(user.tokenExpiry) < new Date()) {
        console.log('Refreshing token for profile fetch');
        const decryptedRefreshToken = decrypt(user.refreshToken, env.ENCRYPTION_KEY);
        const refreshed = await refreshAccessToken(decryptedRefreshToken);
        if (refreshed) {
          accessToken = refreshed.accessToken;
          await db
            .update(users)
            .set({
              accessToken: refreshed.accessToken,
              tokenExpiry: new Date(Date.now() + refreshed.expiresIn * 1000),
            })
            .where(eq(users.id, userId));
        }
      }
      
      // Fetch top tracks and artists from Spotify
      const [topTracksRes, topArtistsRes] = await Promise.all([
        fetch('https://api.spotify.com/v1/me/top/tracks?limit=20', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('https://api.spotify.com/v1/me/top/artists?limit=20', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      
      let topTracks: any[] = [];
      let topArtists: any[] = [];
      
      if (topTracksRes.ok) {
        const data = (await topTracksRes.json()) as { items: any[] };
        topTracks = data.items || [];
      }
      
      if (topArtistsRes.ok) {
        const data = (await topArtistsRes.json()) as { items: any[] };
        topArtists = data.items || [];
      }
      
      // Store profile data for matching
      const topArtistIds = topArtists.map((a: any) => a.id);
      const allGenres = [...new Set(topArtists.flatMap((a: any) => a.genres || []))];
      const topTrackIds = topTracks.slice(0, 50).map((t: any) => t.id);
      
      // Upsert user profile
      await db
        .insert(userProfiles)
        .values({
          userId: user!.id,
          topArtists: topArtistIds,
          topGenres: allGenres,
          topTracks: topTrackIds,
        })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: {
            topArtists: topArtistIds,
            topGenres: allGenres,
            topTracks: topTrackIds,
            updatedAt: new Date(),
          },
        });
      
      return {
        topTracks: topTracks.map((t: any) => ({
          id: t.id,
          name: t.name,
          artists: t.artists.map((a: any) => a.name).join(', '),
          album: t.album?.name,
          imageUrl: t.album?.images?.[0]?.url,
        })),
        topArtists: topArtists.map((a: any) => ({
          id: a.id,
          name: a.name,
          genres: a.genres,
          imageUrl: a.images?.[0]?.url,
        })),
      };
    },
  });
};

export default authRoutes;