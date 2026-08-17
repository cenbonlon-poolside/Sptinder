import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { tracks, users, swipes } from '../db/schema.js';
import { eq, notInArray } from 'drizzle-orm';

const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

// Genre seeds for track discovery
const DISCOVERY_GENRES = [
  'pop', 'rock', 'hip-hop', 'electronic', 'indie',
  'alternative', 'dance', 'country', 'r-n-b', 'jazz'
];

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
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRecord?.accessToken) {
      return [];
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
        Authorization: `Bearer ${userRecord.accessToken}`,
      },
    });

    if (!searchResponse.ok) {
      console.error('Search failed:', searchResponse.status);
      return [];
    }

    const data = (await searchResponse.json()) as SpotifySearchResponse;
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