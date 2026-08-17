import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { validateEnv } from '../env.js';
import crypto from 'crypto';

const env = validateEnv();

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_PROFILE_URL = 'https://api.spotify.com/v1/me';

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

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
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
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    const state = crypto.randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      client_id: env.SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${request.headers.origin}/auth/callback`,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state,
      scope: 'user-read-private playlist-modify-public playlist-modify-private',
    });

    reply.setCookie('spotify_verifier', codeVerifier, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
    });
    reply.setCookie('spotify_state', state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
    });

    return reply.redirect(`${SPOTIFY_AUTH_URL}?${params}`);
  });

  const callbackBodySchema = z.object({
    code: z.string(),
    state: z.string().optional(),
  });

  fastify.post('/callback', async (request, reply) => {
    const { code, state } = callbackBodySchema.parse(request.body);

    const storedState = request.cookies['spotify_state'];
    const codeVerifier = request.cookies['spotify_verifier'];

    if (!storedState || storedState !== state) {
      return reply.status(400).send({ error: 'Invalid state' });
    }

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
        redirect_uri: `${request.headers.origin}/auth/callback`,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      return reply.status(400).send({ error: 'Token exchange failed' });
    }

    const tokens = (await tokenResponse.json()) as SpotifyTokenResponse;

    const profileResponse = await fetch(SPOTIFY_PROFILE_URL, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      return reply.status(400).send({ error: 'Failed to fetch profile' });
    }

    const profile = (await profileResponse.json()) as SpotifyProfile;

    let user = await db.query.users.findFirst({
      where: eq(users.spotifyId, profile.id),
    });

    if (!user) {
      const [newUser] = await db
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
      user = newUser!;
    } else {
      await db
        .update(users)
        .set({
          refreshToken: encrypt(tokens.refresh_token, env.ENCRYPTION_KEY),
          accessToken: tokens.access_token,
          tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        })
        .where(eq(users.id, user.id));
    }

    const token = fastify.jwt.sign({ userId: user.id, spotifyId: user.spotifyId });

    reply
      .clearCookie('spotify_verifier')
      .clearCookie('spotify_state')
      .setCookie('token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      })
      .send({ success: true });
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
};

export default authRoutes;