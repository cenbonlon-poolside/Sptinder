import { z } from 'zod';
import { db } from '../db/index.js';
import { tracks, users, swipes } from '../db/schema.js';
import { eq, notInArray } from 'drizzle-orm';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const trackResponseSchema = z.object({
    id: z.string(),
    spotifyId: z.string(),
    name: z.string(),
    artist: z.string(),
    album: z.string().nullable(),
    previewUrl: z.string().nullable(),
    imageUrl: z.string().nullable(),
    durationMs: z.number().int().positive().nullable(),
    popularity: z.number().int().min(0).max(100).nullable(),
});
const trackRoutes = async (fastify) => {
    fastify.get('/next', {
        onRequest: [fastify.authenticate],
        schema: {
            response: {
                200: z.object({
                    tracks: z.array(trackResponseSchema),
                }),
            },
        },
    }, async (request) => {
        const userId = request.user.userId;
        const userSwipes = await db.query.swipes.findMany({
            where: eq(swipes.userId, userId),
            columns: { trackId: true },
        });
        const swipedTrackIds = userSwipes.map((s) => s.trackId);
        let availableTracks = await db.query.tracks.findMany({
            where: swipedTrackIds.length > 0 ? notInArray(tracks.id, swipedTrackIds) : undefined,
            limit: 1,
        });
        if (availableTracks.length === 0) {
            availableTracks = await fetchAndStoreRecommendations(userId);
        }
        return { tracks: availableTracks };
    });
    async function fetchAndStoreRecommendations(userId) {
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
        const { genres } = (await genresResponse.json());
        const seedGenres = genres.slice(0, 5).join(',');
        const recommendationsResponse = await fetch(`${SPOTIFY_API_URL}/recommendations?seed_genres=${seedGenres}&limit=50&market=US`, {
            headers: {
                Authorization: `Bearer ${userRecord.accessToken}`,
            },
        });
        if (!recommendationsResponse.ok) {
            return [];
        }
        const { tracks: spotifyTracks } = (await recommendationsResponse.json());
        const newTracks = await db
            .insert(tracks)
            .values(spotifyTracks.map((t) => ({
            spotifyId: t.id,
            name: t.name,
            artist: t.artists.map((a) => a.name).join(', '),
            album: t.album?.name ?? null,
            previewUrl: t.preview_url,
            imageUrl: t.album?.images?.[0]?.url ?? null,
            durationMs: t.duration_ms,
            popularity: t.popularity,
        })))
            .onConflictDoNothing()
            .returning();
        return newTracks.map((t) => ({
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
