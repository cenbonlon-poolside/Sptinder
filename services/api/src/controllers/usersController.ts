import { Request, Response, NextFunction } from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';

const createSpotifyApi = (accessToken?: string) => {
  const spotifyApi = new SpotifyWebApi({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret,
    redirectUri: config.spotify.redirectUri
  });

  if (accessToken) {
    spotifyApi.setAccessToken(accessToken);
  }

  return spotifyApi;
};

export const usersController = {
  // Get user profile
  getProfile: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          spotifyId: true,
          email: true,
          displayName: true,
          profileImageUrl: true,
          country: true,
          createdAt: true,
          _count: {
            select: {
              swipes: true,
              matches: true
            }
          }
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      res.json({ success: true, user });
    } catch (error) {
      logger.error('Error getting user profile', { error });
      throw new AppError('Failed to get user profile', 500);
    }
  },

  // Update user profile
  updateProfile: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { displayName } = req.body;

      const user = await prisma.user.update({
        where: { id: userId },
        data: { displayName },
        select: {
          id: true,
          spotifyId: true,
          email: true,
          displayName: true,
          profileImageUrl: true,
          country: true,
          createdAt: true
        }
      });

      res.json({ success: true, user });
    } catch (error) {
      logger.error('Error updating user profile', { error });
      throw new AppError('Failed to update user profile', 500);
    }
  },

  // Get user's playlists
  getPlaylists: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { spotifyAccessToken: true }
      });

      if (!user?.spotifyAccessToken) {
        throw new AppError('Spotify access token not available', 401);
      }

      const spotifyApi = createSpotifyApi(user.spotifyAccessToken);

      // Get user's playlists from Spotify
      const playlistsData = await spotifyApi.getUserPlaylists();
      const playlists = playlistsData.body.items.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        imageUrl: playlist.images[0]?.url,
        externalUrl: playlist.external_urls.spotify,
        trackCount: playlist.tracks.total,
        isPublic: playlist.public,
        owner: playlist.owner.display_name
      }));

      // Also get collaborative playlists from our database
      const dbPlaylists = await prisma.playlist.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          spotifyId: true,
          name: true,
          description: true,
          imageUrl: true,
          externalUrl: true,
          trackCount: true,
          isPublic: true,
          createdAt: true
        }
      });

      res.json({
        success: true,
        playlists: {
          spotify: playlists,
          collaborative: dbPlaylists
        }
      });
    } catch (error) {
      logger.error('Error getting user playlists', { error });
      throw new AppError('Failed to get user playlists', 500);
    }
  },

  // Create collaborative playlist
  createPlaylist: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { name, description, isPublic = false, songIds = [] } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Playlist name is required'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { spotifyAccessToken: true, displayName: true }
      });

      if (!user?.spotifyAccessToken) {
        throw new AppError('Spotify access token not available', 401);
      }

      const spotifyApi = createSpotifyApi(user.spotifyAccessToken);

      // Create playlist on Spotify
      const playlistData = await spotifyApi.createPlaylist(name, description || '', {
        public: isPublic
      });

      const spotifyPlaylist = playlistData.body;

      // Add songs to playlist if provided
      if (songIds.length > 0) {
        const songSpotifyIds = await prisma.song.findMany({
          where: { id: { in: songIds } },
          select: { spotifyId: true }
        });

        if (songSpotifyIds.length > 0) {
          await spotifyApi.addTracksToPlaylist(
            spotifyPlaylist.id,
            songSpotifyIds.map(song => `spotify:track:${song.spotifyId}`)
          );
        }
      }

      // Save playlist to our database
      const playlist = await prisma.playlist.create({
        data: {
          spotifyId: spotifyPlaylist.id,
          name: spotifyPlaylist.name,
          description: spotifyPlaylist.description,
          imageUrl: spotifyPlaylist.images[0]?.url,
          externalUrl: spotifyPlaylist.external_urls.spotify,
          ownerId: userId,
          isPublic,
          trackCount: songIds.length
        }
      });

      logger.info('Collaborative playlist created', {
        playlistId: playlist.id,
        spotifyId: playlist.spotifyId,
        songCount: songIds.length
      });

      res.json({
        success: true,
        playlist: {
          id: playlist.id,
          spotifyId: playlist.spotifyId,
          name: playlist.name,
          description: playlist.description,
          imageUrl: playlist.imageUrl,
          externalUrl: playlist.externalUrl,
          trackCount: playlist.trackCount,
          isPublic: playlist.isPublic,
          createdAt: playlist.createdAt
        }
      });
    } catch (error) {
      logger.error('Error creating collaborative playlist', { error });
      throw new AppError('Failed to create playlist', 500);
    }
  }
};