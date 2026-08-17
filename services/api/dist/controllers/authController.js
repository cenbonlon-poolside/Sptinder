"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const spotify_web_api_node_1 = __importDefault(require("spotify-web-api-node"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const spotifyApi = new spotify_web_api_node_1.default({
    clientId: config_1.config.spotify.clientId,
    clientSecret: config_1.config.spotify.clientSecret,
    redirectUri: config_1.config.spotify.redirectUri
});
exports.authController = {
    // Initiate Spotify OAuth flow
    initiateSpotifyAuth: async (req, res) => {
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
        }
        catch (error) {
            logger_1.logger.error('Error initiating Spotify auth', { error });
            throw new errorHandler_1.AppError('Failed to initiate Spotify authentication', 500);
        }
    },
    // Handle Spotify OAuth callback
    handleSpotifyCallback: async (req, res) => {
        try {
            const { code, error: spotifyError } = req.query;
            if (spotifyError) {
                logger_1.logger.error('Spotify auth error', { error: spotifyError });
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
            const user = await prisma_1.prisma.user.upsert({
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
            const token = jsonwebtoken_1.default.sign({ userId: user.id, spotifyId: user.spotifyId }, config_1.config.jwtSecret, { expiresIn: config_1.config.jwtExpiresIn });
            logger_1.logger.info('User authenticated successfully', { userId: user.id, spotifyId });
            // Redirect to frontend with token
            const frontendUrl = config_1.config.spotify.redirectUri.replace('/api/v1/auth/callback', '');
            res.redirect(`${frontendUrl}/auth/callback?token=${token}&success=true`);
        }
        catch (error) {
            logger_1.logger.error('Error handling Spotify callback', { error });
            const frontendUrl = config_1.config.spotify.redirectUri.replace('/api/v1/auth/callback', '');
            res.redirect(`${frontendUrl}/auth/callback?error=auth_failed`);
        }
    },
    // Exchange code for token
    exchangeCode: async (req, res) => {
        try {
            const { code } = req.body;
            if (!code || typeof code !== 'string') {
                return res.status(400).json({ error: 'Code is required' });
            }
            // Exchange code for access token
            spotifyApi.setRedirectURI(config_1.config.spotify.redirectUri);
            const data = await spotifyApi.authorizationCodeGrant(code);
            const { access_token, refresh_token, expires_in } = data.body;
            // Set access token for API calls
            spotifyApi.setAccessToken(access_token);
            spotifyApi.setRefreshToken(refresh_token);
            // Get user profile from Spotify
            const userProfile = await spotifyApi.getMe();
            const { id: spotifyId, email, display_name, country, images } = userProfile.body;
            // Save or update user in database
            const user = await prisma_1.prisma.user.upsert({
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
            const token = jsonwebtoken_1.default.sign({ userId: user.id, spotifyId: user.spotifyId }, config_1.config.jwtSecret, { expiresIn: config_1.config.jwtExpiresIn });
            logger_1.logger.info('Code exchanged successfully', { userId: user.id, spotifyId });
            res.json({ token });
        }
        catch (error) {
            logger_1.logger.error('Error exchanging code', { error });
            res.status(400).json({ error: 'Failed to exchange code' });
        }
    },
    refreshToken: async (req, res) => {
        try {
            const userId = req.user.userId;
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId }
            });
            if (!user || !user.spotifyRefreshToken) {
                throw new errorHandler_1.AppError('User not found or no refresh token available', 404);
            }
            // Refresh Spotify token
            spotifyApi.setRefreshToken(user.spotifyRefreshToken);
            const data = await spotifyApi.refreshAccessToken();
            const { access_token, expires_in } = data.body;
            // Update user in database
            await prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    spotifyAccessToken: access_token,
                    tokenExpiresAt: new Date(Date.now() + expires_in * 1000)
                }
            });
            // Generate new JWT
            const token = jsonwebtoken_1.default.sign({ userId: user.id, spotifyId: user.spotifyId }, config_1.config.jwtSecret, { expiresIn: config_1.config.jwtExpiresIn });
            res.json({
                success: true,
                token,
                expiresIn: config_1.config.jwtExpiresIn
            });
        }
        catch (error) {
            logger_1.logger.error('Error refreshing token', { error });
            throw new errorHandler_1.AppError('Failed to refresh token', 500);
        }
    },
    // Logout
    logout: async (req, res) => {
        try {
            const userId = req.user.userId;
            // Clear tokens from database
            await prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    spotifyAccessToken: null,
                    spotifyRefreshToken: null,
                    tokenExpiresAt: null
                }
            });
            res.json({ success: true, message: 'Logged out successfully' });
        }
        catch (error) {
            logger_1.logger.error('Error logging out', { error });
            throw new errorHandler_1.AppError('Failed to logout', 500);
        }
    },
    // Get current user
    getCurrentUser: async (req, res) => {
        try {
            const userId = req.user.userId;
            const user = await prisma_1.prisma.user.findUnique({
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
                throw new errorHandler_1.AppError('User not found', 404);
            }
            res.json({ success: true, user });
        }
        catch (error) {
            logger_1.logger.error('Error getting current user', { error });
            throw new errorHandler_1.AppError('Failed to get user profile', 500);
        }
    }
};
//# sourceMappingURL=authController.js.map