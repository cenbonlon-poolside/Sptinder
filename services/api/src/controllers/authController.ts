import { Request, Response, NextFunction } from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';

const spotifyApi = new SpotifyWebApi({
  clientId: config.spotify.clientId,
  clientSecret: config.spotify.clientSecret,
  redirectUri: config.spotify.redirectUri
});

export const authController = {
  // Initiate Spotify OAuth flow
  initiateSpotifyAuth: async (req: Request, res: Response) => {
    try {
      const scopes = [
        'user-read-private',
        'user-read-email',
        'user-top-read',
        'user-library-read',
        'playlist-modify-public',
        'playlist-modify-private'
      ];

      const authorizeURL = spotifyApi.createAuthorizeURL(scopes, 'sptinder-auth');
      res.json({ url: authorizeURL });
    } catch (error) {
      logger.error('Error initiating Spotify auth', { error });
      throw new AppError('Failed to initiate Spotify authentication', 500);
    }
  },

  // Handle Spotify OAuth callback
  handleSpotifyCallback: async (req: Request, res: Response) => {
    try {
      const { code, error: spotifyError } = req.query;

      if (spotifyError) {
        logger.error('Spotify auth error', { error: spotifyError });
        return res.status(400).json({
          success: false,
          error: 'Spotify authentication failed'
        });
      }

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Authorization code is required'
        });
      }

      // Exchange code for access token
      const data = await spotifyApi.authorizationCodeGrant(code);
      const { access_token, refresh_token, expires_in } = data.body;

      // Set access token for API calls
      spotifyApi.setAccessToken(access_token);
      spotifyApi.setRefreshToken(refresh_token);

      // Get user profile from Spotify
      const userProfile = await spotifyApi.getMe();
      const { id: spotifyId, email, display_name, country, images } = userProfile.body;

      // Save or update user in database
      const user = await prisma.user.upsert({
        where: { spotifyId },
        update: {
          email,
          displayName: display_name,
          country,
          profileImageUrl: images?.[0]?.url,
          spotifyAccessToken: access_token,
          spotifyRefreshToken: refresh_token,
          tokenExpiresAt: new Date(Date.now() + expires_in * 1000)
        },
        create: {
          spotifyId,
          email,
          displayName: display_name,
          country,
          profileImageUrl: images?.[0]?.url,
          spotifyAccessToken: access_token,
          spotifyRefreshToken: refresh_token,
          tokenExpiresAt: new Date(Date.now() + expires_in * 1000)
        }
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, spotifyId: user.spotifyId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as string }
      );

      logger.info('User authenticated successfully', { userId: user.id, spotifyId });

      // Redirect to frontend with token
      const frontendUrl = config.spotify.redirectUri.replace('/api/v1/auth/callback', '');
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&success=true`);

    } catch (error) {
      logger.error('Error handling Spotify callback', { error });
      const frontendUrl = config.spotify.redirectUri.replace('/api/v1/auth/callback', '');
      res.redirect(`${frontendUrl}/auth/callback?error=auth_failed`);
    }
  },

  // Exchange code for token
  exchangeCode: async (req: Request, res: Response) => {
    try {
      const { code } = req.body;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Code is required' });
      }

      // Exchange code for access token
      spotifyApi.setRedirectURI(config.spotify.redirectUri);
      const data = await spotifyApi.authorizationCodeGrant(code);
      const { access_token, refresh_token, expires_in } = data.body;

      // Set access token for API calls
      spotifyApi.setAccessToken(access_token);
      spotifyApi.setRefreshToken(refresh_token);

      // Get user profile from Spotify
      const userProfile = await spotifyApi.getMe();
      const { id: spotifyId, email, display_name, country, images } = userProfile.body;

      // Save or update user in database
      const user = await prisma.user.upsert({
        where: { spotifyId },
        update: {
          email,
          displayName: display_name,
          country,
          profileImageUrl: images?.[0]?.url,
          spotifyAccessToken: access_token,
          spotifyRefreshToken: refresh_token,
          tokenExpiresAt: new Date(Date.now() + expires_in * 1000)
        },
        create: {
          spotifyId,
          email,
          displayName: display_name,
          country,
          profileImageUrl: images?.[0]?.url,
          spotifyAccessToken: access_token,
          spotifyRefreshToken: refresh_token,
          tokenExpiresAt: new Date(Date.now() + expires_in * 1000)
        }
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, spotifyId: user.spotifyId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as string }
      );

      logger.info('Code exchanged successfully', { userId: user.id, spotifyId });

      res.json({ token });
    } catch (error) {
      logger.error('Error exchanging code', { error });
      res.status(400).json({ error: 'Failed to exchange code' });
    }
  },
  refreshToken: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.spotifyRefreshToken) {
        throw new AppError('User not found or no refresh token available', 404);
      }

      // Refresh Spotify token
      spotifyApi.setRefreshToken(user.spotifyRefreshToken);
      const data = await spotifyApi.refreshAccessToken();
      const { access_token, expires_in } = data.body;

      // Update user in database
      await prisma.user.update({
        where: { id: userId },
        data: {
          spotifyAccessToken: access_token,
          tokenExpiresAt: new Date(Date.now() + expires_in * 1000)
        }
      });

      // Generate new JWT
      const token = jwt.sign(
        { userId: user.id, spotifyId: user.spotifyId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as string }
      );

      res.json({
        success: true,
        token,
        expiresIn: config.jwtExpiresIn
      });

    } catch (error) {
      logger.error('Error refreshing token', { error });
      throw new AppError('Failed to refresh token', 500);
    }
  },

  // Logout
  logout: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      // Clear tokens from database
      await prisma.user.update({
        where: { id: userId },
        data: {
          spotifyAccessToken: null,
          spotifyRefreshToken: null,
          tokenExpiresAt: null
        }
      });

      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Error logging out', { error });
      throw new AppError('Failed to logout', 500);
    }
  },

  // Get current user
  getCurrentUser: async (req: Request, res: Response) => {
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
          createdAt: true
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      res.json({ success: true, user });
    } catch (error) {
      logger.error('Error getting current user', { error });
      throw new AppError('Failed to get user profile', 500);
    }
  }
};