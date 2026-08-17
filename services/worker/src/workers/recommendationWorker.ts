import { Worker } from 'bullmq';
import SpotifyWebApi from 'spotify-web-api-node';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { recommendationQueue } from '../queues/queueSetup';

const prisma = new PrismaClient();

export const recommendationWorker = new Worker(
  'recommendations',
  async (job) => {
    const { userId, limit = 20 } = job.data;

    logger.info(`Generating recommendations for user ${userId}`);

    try {
      // Get user's music preferences from swipes
      const userSwipes = await prisma.swipe.findMany({
        where: { userId },
        include: { song: true }
      });

      const likedGenres = new Map<string, number>();
      const likedArtists = new Map<string, number>();

      // Analyze liked songs
      userSwipes.forEach(swipe => {
        if (swipe.action === 'like' && swipe.song) {
          // Count genres
          if (swipe.song.genres) {
            swipe.song.genres.forEach((genre: string) => {
              likedGenres.set(genre, (likedGenres.get(genre) || 0) + 1);
            });
          }

          // Count artists
          if (swipe.song.artistName) {
            likedArtists.set(swipe.song.artistName, (likedArtists.get(swipe.song.artistName) || 0) + 1);
          }
        }
      });

      // Get top preferences
      const topGenres = Array.from(likedGenres.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre);

      const topArtists = Array.from(likedArtists.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([artist]) => artist);

      // Initialize Spotify API
      const spotifyApi = new SpotifyWebApi({
        clientId: config.spotify.clientId,
        clientSecret: config.spotify.clientSecret
      });

      // Get access token
      const authData = await spotifyApi.clientCredentialsGrant();
      spotifyApi.setAccessToken(authData.body.access_token);

      const recommendations: any[] = [];

      // Get recommendations based on top genres and artists
      if (topGenres.length > 0 || topArtists.length > 0) {
        const seedGenres = topGenres.slice(0, 2);
        const seedArtists = topArtists.slice(0, 1);

        try {
          const recs = await spotifyApi.getRecommendations({
            seed_genres: seedGenres,
            seed_artists: seedArtists,
            limit: limit,
            market: 'US'
          });

          recommendations.push(...recs.body.tracks);
        } catch (error) {
          logger.warn('Error getting Spotify recommendations:', error);
        }
      }

      // Fallback: get popular tracks if no preferences
      if (recommendations.length === 0) {
        try {
          const popular = await spotifyApi.getPlaylistTracks('37i9dQZF1DXcBWIGoYBM5M', {
            limit: limit
          });
          recommendations.push(...popular.body.items.map((item: any) => item.track));
        } catch (error) {
          logger.error('Error getting fallback recommendations:', error);
        }
      }

      // Store recommendations in database
      const recommendationRecords = recommendations.map(track => ({
        userId,
        spotifyId: track.id,
        name: track.name,
        artistName: track.artists[0].name,
        albumName: track.album.name,
        imageUrl: track.album.images[0]?.url,
        previewUrl: track.preview_url,
        externalUrl: track.external_urls.spotify,
        genres: [], // Would need additional API call to get genres
        createdAt: new Date()
      }));

      // Remove duplicates and save
      const existingIds = new Set(
        (await prisma.song.findMany({
          where: { spotifyId: { in: recommendationRecords.map(r => r.spotifyId) } },
          select: { spotifyId: true }
        })).map(s => s.spotifyId)
      );

      const newRecommendations = recommendationRecords.filter(r => !existingIds.has(r.spotifyId));

      if (newRecommendations.length > 0) {
        await prisma.song.createMany({
          data: newRecommendations,
          skipDuplicates: true
        });
      }

      logger.info(`Generated ${newRecommendations.length} recommendations for user ${userId}`);
      return { count: newRecommendations.length };

    } catch (error) {
      logger.error(`Error generating recommendations for user ${userId}:`, error);
      throw error;
    }
  },
  {
    connection: {
      url: config.redis.url
    }
  }
);

// Handle worker events
recommendationWorker.on('completed', (job) => {
  logger.info(`Recommendation job ${job.id} completed`);
});

recommendationWorker.on('failed', (job, err) => {
  logger.error(`Recommendation job ${job?.id} failed:`, err);
});