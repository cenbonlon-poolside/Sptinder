import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
// Get env values directly from process.env (no validation at import time)
function getEnv() {
    return {
        SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
        SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
        JWT_SECRET: process.env.JWT_SECRET,
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
        PORT: Number(process.env.PORT || 3000),
        NODE_ENV: (process.env.NODE_ENV || 'development'),
    };
}
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_PROFILE_URL = 'https://api.spotify.com/v1/me';
// Use REDIRECT_URI from env, or derive from request
function getRedirectUri(request) {
    if (process.env.REDIRECT_URI) {
        return process.env.REDIRECT_URI;
    }
    const host = request.headers.host || 'localhost:3000';
    const protocol = request.headers['x-forwarded-proto'] || 'https';
    return `${protocol}://${host}/api/auth/callback`;
}
function generateCodeVerifier() {
    return crypto.randomBytes(64).toString('hex').slice(0, 128);
}
function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}
function encrypt(text, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}
async function refreshAccessToken(refreshToken) {
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
    if (!response.ok)
        return null;
    const tokens = (await response.json());
    return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? refreshToken,
        expiresIn: tokens.expires_in,
    };
}
const authRoutes = async (fastify) => {
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
        const { code, state } = callbackBodySchema.parse(request.query);
        const redirectUri = getRedirectUri(request);
        const storedState = request.cookies['spotify_state'];
        const codeVerifier = request.cookies['spotify_verifier'];
        console.log('Callback received - state:', state, 'stored:', storedState, 'verifier:', codeVerifier ? 'present' : 'missing');
        if (!storedState || storedState !== state) {
            console.log('State mismatch - returning 400');
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
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });
        if (!tokenResponse.ok) {
            const errorBody = await tokenResponse.text();
            console.error('Token exchange failed:', tokenResponse.status, errorBody);
            return reply.status(400).send({ error: 'Token exchange failed', details: { status: tokenResponse.status, body: errorBody } });
        }
        const tokens = (await tokenResponse.json());
        const profileResponse = await fetch(SPOTIFY_PROFILE_URL, {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });
        if (!profileResponse.ok) {
            const errorBody = await profileResponse.text();
            console.error('Profile fetch failed:', profileResponse.status, errorBody);
            return reply.status(400).send({ error: 'Failed to fetch profile', details: { status: profileResponse.status, body: errorBody } });
        }
        const profile = (await profileResponse.json());
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
            user = newUser;
        }
        else {
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
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
        })
            .send({ success: true });
    });
    fastify.get('/me', {
        onRequest: [fastify.authenticate],
        handler: async (request, reply) => {
            const user = await db.query.users.findFirst({
                where: eq(users.id, request.user.userId),
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
