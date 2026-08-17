import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { playlists, swipes, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { validateEnv } from '../env.js';

const env = validateEnv();
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
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

interface SpotifyPlaylistResponse {
  id: string;
  name: string;
}

const playlistRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/sync',
    {
      onRequest: [fastify.authenticate],
    },
    async (request: FastifyRequest) => {
      const userId = (request.user as { userId: string }).userId;

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user?.refreshToken) {
        return { success: false, playlist: null } as const;
      }

      // Get all right-swiped tracks
      const rightSwipes = await db.query.swipes.findMany({
        where: eq(swipes.userId, userId),
        with: { track: true },
      });

      const keptTracks = rightSwipes.filter((s) => s.direction === 'right').map((s) => s.track!);

      if (keptTracks.length === 0) {
        return { success: true, playlist: null } as const;
      }

      // Find or create Sptinder playlist
      let playlist = await db.query.playlists.findFirst({
        where: eq(playlists.userId, userId),
      });

      let accessToken = user.accessToken;
      let spotifyPlaylistId: string;

      if (!playlist) {
        // Create new playlist
        const createResponse = await fetch(`${SPOTIFY_API_URL}/users/${user.spotifyId}/playlists`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Sptinder',
            description: 'Tracks discovered with Sptinder',
            public: false,
          }),
        });

        if (!createResponse.ok) {
          // Try refreshing token
          const refreshed = await refreshAccessToken(user.refreshToken);
          if (!refreshed) {
            return { success: false, playlist: null } as const;
          }
          
          // Update user's access token
          await db
            .update(users)
            .set({
              accessToken: refreshed.accessToken,
              tokenExpiry: new Date(Date.now() + refreshed.expiresIn * 1000),
            })
            .where(eq(users.id, userId));
          
          accessToken = refreshed.accessToken;

          // Retry playlist creation
          const retryResponse = await fetch(`${SPOTIFY_API_URL}/users/${user.spotifyId}/playlists`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: 'Sptinder',
              description: 'Tracks discovered with Sptinder',
              public: false,
            }),
          });

          if (!retryResponse.ok) {
            return { success: false, playlist: null } as const;
          }

          const newPlaylist = (await retryResponse.json()) as SpotifyPlaylistResponse;
          spotifyPlaylistId = newPlaylist.id;

          const [createdPlaylist] = await db
            .insert(playlists)
            .values({
              userId,
              spotifyPlaylistId: newPlaylist.id,
            })
            .returning();
          playlist = createdPlaylist!;
        } else {
          const newPlaylist = (await createResponse.json()) as SpotifyPlaylistResponse;
          spotifyPlaylistId = newPlaylist.id;

          const [createdPlaylist] = await db
            .insert(playlists)
            .values({
              userId,
              spotifyPlaylistId: newPlaylist.id,
            })
            .returning();
          playlist = createdPlaylist!;
        }
      }

      spotifyPlaylistId = playlist.spotifyPlaylistId;

      // Add tracks to playlist in batches of 100
      const trackUris = keptTracks.map((t) => `spotify:track:${t.spotifyId}`);
      
      for (let i = 0; i < trackUris.length; i += 100) {
        const batch = trackUris.slice(i, i + 100);
        await fetch(`${SPOTIFY_API_URL}/playlists/${spotifyPlaylistId}/tracks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uris: batch }),
        });
      }

      // Update sync time
      await db
        .update(playlists)
        .set({ syncedAt: new Date() })
        .where(eq(playlists.id, playlist.id));

      return {
        success: true,
        playlist: {
          id: playlist.id,
          spotifyPlaylistId: playlist.spotifyPlaylistId,
          trackCount: keptTracks.length,
        },
      };
    },
  );
};

export default playlistRoutes;