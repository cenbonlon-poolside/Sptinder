import { Worker } from 'bullmq';
import SpotifyWebApi from 'spotify-web-api-node';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { playlistQueue } from '../queues/queueSetup';

const prisma = new PrismaClient();

export const playlistWorker = new Worker(
  'playlists',
  async (job) => {
    const { matchId, userId, accessToken } = job.data;

    logger.info(`Creating collaborative playlist for match ${matchId}`);

    try {
      // Get match details
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          user1: true,
          user2: true
        }
      });

      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      // Determine the other user
      const otherUser = match.user1.id === userId ? match.user2 : match.user1;

      // Initialize Spotify API with user's access token
      const spotifyApi = new SpotifyWebApi({
        clientId: config.spotify.clientId,
        clientSecret: config.spotify.clientSecret
      });
      spotifyApi.setAccessToken(accessToken);

      // Create collaborative playlist
      const playlistName = `Sptinder Match: ${match.user1.displayName} & ${match.user2.displayName}`;
      const playlistDescription = `A collaborative playlist created by Sptinder for ${match.user1.displayName} and ${match.user2.displayName}`;

      const playlist = await spotifyApi.createPlaylist(
        playlistName,
        playlistDescription,
        { public: false }
      );

      const playlistId = playlist.body.id;

      // Get liked songs from both users
      const user1Swipes = await prisma.swipe.findMany({
        where: {
          userId: match.user1.id,
          action: 'like'
        },
        include: { song: true },
        take: 10
      });

      const user2Swipes = await prisma.swipe.findMany({
        where: {
          userId: match.user2.id,
          action: 'like'
        },
        include: { song: true },
        take: 10
      });

      // Combine and deduplicate songs
      const allSongs = [...user1Swipes, ...user2Swipes];
      const uniqueSongs = allSongs.filter((swipe, index, self) =>
        index === self.findIndex(s => s.song.spotifyId === swipe.song.spotifyId)
      );

      // Add songs to playlist
      if (uniqueSongs.length > 0) {
        const trackUris = uniqueSongs.map(swipe => `spotify:track:${swipe.song.spotifyId}`);
        await spotifyApi.addTracksToPlaylist(playlistId, trackUris);
      }

      // Store playlist info in database
      await prisma.collaborativePlaylist.create({
        data: {
          matchId,
          spotifyId: playlistId,
          name: playlistName,
          description: playlistDescription,
          trackCount: uniqueSongs.length,
          createdById: userId
        }
      });

      logger.info(`Created collaborative playlist ${playlistId} for match ${matchId}`);
      return {
        playlistId,
        name: playlistName,
        trackCount: uniqueSongs.length
      };

    } catch (error) {
      logger.error(`Error creating playlist for match ${matchId}:`, error);
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
playlistWorker.on('completed', (job) => {
  logger.info(`Playlist job ${job.id} completed`);
});

playlistWorker.on('failed', (job, err) => {
  logger.error(`Playlist job ${job?.id} failed:`, err);
});