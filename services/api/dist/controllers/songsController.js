"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.songsController = void 0;
const spotify_web_api_node_1 = __importDefault(require("spotify-web-api-node"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const createSpotifyApi = (accessToken) => {
    const spotifyApi = new spotify_web_api_node_1.default({
        clientId: config_1.config.spotify.clientId,
        clientSecret: config_1.config.spotify.clientSecret,
        redirectUri: config_1.config.spotify.redirectUri
    });
    if (accessToken) {
        spotifyApi.setAccessToken(accessToken);
    }
    return spotifyApi;
};
exports.songsController = {
    // Get songs for swiping
    getSongsForSwiping: async (req, res) => {
        try {
            const userId = req.user.userId;
            const { limit = 10, genre, popularity } = req.query;
            // Get user's swiped songs to exclude
            const swipedSongIds = await prisma_1.prisma.swipe.findMany({
                where: { userId },
                select: { songId: true }
            });
            const excludeIds = swipedSongIds.map(s => s.songId);
            // Get songs from database that haven't been swiped
            let songs = await prisma_1.prisma.song.findMany({
                where: {
                    id: { notIn: excludeIds },
                    ...(genre && { genres: { has: genre } }),
                    ...(popularity && { popularity: { gte: parseInt(popularity) } })
                },
                take: parseInt(limit),
                orderBy: { popularity: 'desc' },
                include: {
                    audioFeatures: true
                }
            });
            // If not enough songs in database, fetch from Spotify
            if (songs.length < parseInt(limit)) {
                const user = await prisma_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: { spotifyAccessToken: true }
                });
                if (user?.spotifyAccessToken) {
                    const spotifyApi = createSpotifyApi(user.spotifyAccessToken);
                    // Get recommendations based on user's top artists/genres
                    try {
                        const recommendations = await spotifyApi.getRecommendations({
                            limit: parseInt(limit) - songs.length,
                            seed_genres: genre ? [genre] : ['pop', 'rock', 'hip-hop'],
                            min_popularity: popularity ? parseInt(popularity) : 30
                        });
                        // Save new songs to database
                        for (const track of recommendations.body.tracks) {
                            const existingSong = await prisma_1.prisma.song.findUnique({
                                where: { spotifyId: track.id }
                            });
                            if (!existingSong) {
                                const newSong = await prisma_1.prisma.song.create({
                                    data: {
                                        spotifyId: track.id,
                                        name: track.name,
                                        artist: track.artists[0].name,
                                        album: track.album.name,
                                        imageUrl: track.album.images[0]?.url,
                                        previewUrl: track.preview_url,
                                        externalUrl: track.external_urls.spotify,
                                        durationMs: track.duration_ms,
                                        popularity: track.popularity,
                                        genres: [] // Will be populated later
                                    },
                                    include: {
                                        audioFeatures: true
                                    }
                                });
                                // Try to get audio features
                                try {
                                    const audioFeatures = await spotifyApi.getAudioFeaturesForTrack(track.id);
                                    if (audioFeatures.body) {
                                        await prisma_1.prisma.audioFeatures.create({
                                            data: {
                                                songId: newSong.id,
                                                danceability: audioFeatures.body.danceability,
                                                energy: audioFeatures.body.energy,
                                                key: audioFeatures.body.key,
                                                loudness: audioFeatures.body.loudness,
                                                mode: audioFeatures.body.mode,
                                                speechiness: audioFeatures.body.speechiness,
                                                acousticness: audioFeatures.body.acousticness,
                                                instrumentalness: audioFeatures.body.instrumentalness,
                                                liveness: audioFeatures.body.liveness,
                                                valence: audioFeatures.body.valence,
                                                tempo: audioFeatures.body.tempo,
                                                timeSignature: audioFeatures.body.time_signature
                                            }
                                        });
                                    }
                                }
                                catch (error) {
                                    logger_1.logger.warn('Failed to get audio features', { songId: track.id, error });
                                }
                                songs.push(newSong);
                            }
                        }
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to get Spotify recommendations', { error });
                    }
                }
            }
            res.json({
                success: true,
                songs: songs.map(song => ({
                    id: song.id,
                    spotifyId: song.spotifyId,
                    name: song.name,
                    artist: song.artist,
                    album: song.album,
                    imageUrl: song.imageUrl,
                    previewUrl: song.previewUrl,
                    externalUrl: song.externalUrl,
                    durationMs: song.durationMs,
                    popularity: song.popularity,
                    genres: song.genres,
                    audioFeatures: song.audioFeatures
                }))
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting songs for swiping', { error });
            throw new errorHandler_1.AppError('Failed to get songs', 500);
        }
    },
    // Get song details
    getSongDetails: async (req, res) => {
        try {
            const { songId } = req.params;
            const song = await prisma_1.prisma.song.findUnique({
                where: { id: songId },
                include: {
                    audioFeatures: true
                }
            });
            if (!song) {
                throw new errorHandler_1.AppError('Song not found', 404);
            }
            res.json({ success: true, song });
        }
        catch (error) {
            logger_1.logger.error('Error getting song details', { error, songId: req.params.songId });
            throw new errorHandler_1.AppError('Failed to get song details', 500);
        }
    },
    // Search songs
    searchSongs: async (req, res) => {
        try {
            const { query } = req.params;
            const { limit = 20 } = req.query;
            const songs = await prisma_1.prisma.song.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { artist: { contains: query, mode: 'insensitive' } },
                        { album: { contains: query, mode: 'insensitive' } }
                    ]
                },
                take: parseInt(limit),
                include: {
                    audioFeatures: true
                }
            });
            res.json({ success: true, songs });
        }
        catch (error) {
            logger_1.logger.error('Error searching songs', { error, query: req.params.query });
            throw new errorHandler_1.AppError('Failed to search songs', 500);
        }
    }
};
//# sourceMappingURL=songsController.js.map