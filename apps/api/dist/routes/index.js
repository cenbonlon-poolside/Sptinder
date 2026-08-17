import authRoutes from './auth.js';
import trackRoutes from './tracks.js';
import swipeRoutes from './swipes.js';
import playlistRoutes from './playlists.js';
const apiRoutes = async (fastify) => {
    await fastify.register(authRoutes, { prefix: '/auth' });
    await fastify.register(trackRoutes, { prefix: '/tracks' });
    await fastify.register(swipeRoutes, { prefix: '/swipes' });
    await fastify.register(playlistRoutes, { prefix: '/playlists' });
};
export default apiRoutes;
