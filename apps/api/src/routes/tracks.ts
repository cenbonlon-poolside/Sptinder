import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { tracks, users, swipes } from '../db/schema.js';
import { eq, notInArray } from 'drizzle-orm';

const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

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

interface SpotifyGenreResponse {
  genres: string[];
}

interface SpotifyRecommendationsResponse {
  tracks: Array<{
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: { name: string; images: Array<{ url: string }> } | null;
    preview_url: string | null;
    duration_ms: number;
    popularity: number;
  }>;
}

const trackRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/next',
    {
      onRequest: [fastify.authenticate],
    },
    async (request: FastifyRequest) => {
      const userId = (request.user as { userId: string }).userId;

      const userSwipes = await db.query.swipes.findMany({
        where: eq(swipes.userId, userId),
        columns: { trackId: true },
      });

      const swipedTrackIds = userSwipes.map((s: any) => s.trackId);

      let availableTracks = await db.query.tracks.findMany({
        where: swipedTrackIds.length > 0 ? notInArray(tracks.id, swipedTrackIds) : undefined,
        limit: 1,
      });

      if (availableTracks.length === 0) {
        availableTracks = await fetchAndStoreRecommendations(userId);
      }

      return { tracks: availableTracks as Track[] };
    },
  );

  async function fetchAndStoreRecommendations(userId: string): Promise<Track[]> {
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRecord?.accessToken) {
      return [];
    }

    const genresResponse = await fetch(`${SPOTIFY_API_URL}/recommendations/available-genre-seeds`, {
      headers: {
        Authorization: `Bearer ${userRecord.accessToken}`,
      },
    });

    if (!genresResponse.ok) {
      return [];
    }

    const { genres } = (await genresResponse.json()) as SpotifyGenreResponse;
    const seedGenres = genres.slice(0, 5).join(',');

    const recommendationsResponse = await fetch(
      `${SPOTIFY_API_URL}/recommendations?seed_genres=${seedGenres}&limit=50&market=US`,
      {
        headers: {
          Authorization: `Bearer ${userRecord.accessToken}`,
        },
      },
    );

    if (!recommendationsResponse.ok) {
      return [];
    }

    const { tracks: spotifyTracks } = (await recommendationsResponse.json()) as SpotifyRecommendationsResponse;

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

    return newTracks.map((t: any) => ({
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