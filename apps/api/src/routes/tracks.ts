import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { tracks, users, swipes } from '../db/schema.js';
import { eq, notInArray } from 'drizzle-orm';
import crypto from 'crypto';

const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Genre seeds for track discovery
const DISCOVERY_GENRES = [
  'pop', 'rock', 'hip-hop', 'electronic', 'indie',
  'alternative', 'dance', 'country', 'r-n-b', 'jazz'
];

// Decrypt refresh token (for token refresh)
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

// Refresh access token using stored refresh token
async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  const env = {
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID!,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET!,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
  };

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

  if (!response.ok) {
    console.error('Token refresh failed:', response.status);
    return null;
  }

  const tokens = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: tokens.access_token,
    expiresIn: tokens.expires_in,
  };
}

interface Track {
  id: string;
  spotifyId: string;
  name: string;
  artist: string;
  album: string | null;
  previewUrl: string | null;
  imageUrl: string | null;
  durationMs: number | null;
  popularity: number | null;
}

interface SpotifySearchResponse {
  tracks: {
    items: Array<{
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      album: { name: string; images: Array<{ url: string }> } | null;
      preview_url: string | null;
      duration_ms: number;
      popularity: number;
    }>;
  };
}

const trackRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/next',
    {
      onRequest: [fastify.authenticate],
    },
    async (request: FastifyRequest) => {
      const userId = (request.user as { userId: string }).userId;

      // First, check if user has swiped any tracks
      const userSwipes = await db.query.swipes.findMany({
        where: eq(swipes.userId, userId),
        columns: { trackId: true },
      });

      const swipedTrackIds = userSwipes.map((s: { trackId: string }) => s.trackId);

      // Try to get existing tracks from database
      let availableTracks = await db.query.tracks.findMany({
        where: swipedTrackIds.length > 0 ? notInArray(tracks.id, swipedTrackIds) : undefined,
        limit: 1,
      });

      if (availableTracks.length === 0) {
        availableTracks = await fetchAndStoreTracks(userId);
      }

      return { tracks: availableTracks };
    },
  );

  async function fetchAndStoreTracks(userId: string): Promise<Track[]> {
    console.log('fetchAndStoreTracks called for userId:', userId);
    
    // Use direct query to ensure we get accessToken column
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    let userRecord = result[0] || null;
    console.log('userRecord found:', !!userRecord, 'accessToken:', !!userRecord?.accessToken, 'tokenExpiry:', userRecord?.tokenExpiry, 'hasRefresh:', !!userRecord?.refreshToken);

    // If refresh token is missing, user needs to re-authenticate
    if (!userRecord?.refreshToken) {
      console.log('No refresh token - user needs fresh login');
      return [];
    }

    const env = {
      SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID!,
      SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET!,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
    };

    let accessToken = userRecord.accessToken;
    // Check if we need to refresh the access token
    const needsRefresh = !accessToken || (userRecord?.tokenExpiry && new Date(userRecord.tokenExpiry) < new Date());
    
    if (needsRefresh) {
      console.log('Access token expired or missing, refreshing...');
      
      const decryptedRefreshToken = decrypt(userRecord.refreshToken, env.ENCRYPTION_KEY);
      console.log('Attempting to refresh with decrypt check:', decryptedRefreshToken ? 'token present' : 'empty');
      
      const refreshed = await refreshAccessToken(decryptedRefreshToken);
      if (refreshed) {
        accessToken = refreshed.accessToken;
        // Update user with new token
        await db
          .update(users)
          .set({
            accessToken: refreshed.accessToken,
            tokenExpiry: new Date(Date.now() + refreshed.expiresIn * 1000),
          })
          .where(eq(users.id, userId));
        console.log('Token refreshed successfully');
      } else {
        console.log('Token refresh failed, returning empty');
        return [];
      }
    }

    // Use Search API which works for development mode apps
    const randomGenre = DISCOVERY_GENRES[Math.floor(Math.random() * DISCOVERY_GENRES.length)];
    const params = new URLSearchParams({
      q: `genre:${randomGenre} year:2024`,
      type: 'track',
      limit: '50',
      market: 'US',
    });

    const searchResponse = await fetch(`${SPOTIFY_API_URL}/search?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log('Spotify search response status:', searchResponse.status);
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Search failed:', searchResponse.status, errorText);
      return [];
    }

    const data = (await searchResponse.json()) as SpotifySearchResponse;
    console.log('Spotify search returned tracks:', data.tracks?.items?.length || 0);
    const spotifyTracks = data.tracks.items;

    const newTracks = await db
      .insert(tracks)
      .values(
        spotifyTracks.map((t) => ({
          spotifyId: t.id,
          name: t.name,
          artist: t.artists.map((a) => a.name).join(', '),
          album: t.album?.name ?? null,
          previewUrl: t.preview_url,
          imageUrl: t.album?.images?.[0]?.url ?? null,
          durationMs: t.duration_ms,
          popularity: t.popularity,
        })),
      )
      .onConflictDoNothing()
      .returning();

    return (newTracks as Track[]).map((t) => ({
      id: t.id,
      spotifyId: t.spotifyId,
      name: t.name,
      artist: t.artist,
      album: t.album,
      previewUrl: t.previewUrl,
      imageUrl: t.imageUrl,
      durationMs: t.durationMs,
      popularity: t.popularity,
    }));
  }
};

export default trackRoutes;