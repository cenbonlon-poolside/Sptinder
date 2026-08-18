import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { userProfiles, users } from '../db/schema.js';
import { eq, ne, sql } from 'drizzle-orm';

interface UserProfileWithUser {
  id: string;
  userId: string;
  topArtists: string[] | null;
  topGenres: string[] | null;
  topTracks: string[] | null;
  displayName: string | null;
}

// Calculate similarity score between two users
function calculateSimilarity(profile1: UserProfileWithUser, profile2: UserProfileWithUser): number {
  let score = 0;
  
  // Artist overlap
  const artists1 = profile1.topArtists || [];
  const artists2 = profile2.topArtists || [];
  const artistOverlap = artists1.filter(a => artists2.includes(a)).length;
  score += artistOverlap * 3;
  
  // Genre overlap
  const genres1 = profile1.topGenres || [];
  const genres2 = profile2.topGenres || [];
  const genreOverlap = genres1.filter(g => genres2.includes(g)).length;
  score += genreOverlap * 2;
  
  // Track overlap
  const tracks1 = profile1.topTracks || [];
  const tracks2 = profile2.topTracks || [];
  const trackOverlap = tracks1.filter(t => tracks2.includes(t)).length;
  score += trackOverlap;
  
  return score;
}

const matchRoutes: FastifyPluginAsync = async (fastify) => {
  // Get potential matches based on music taste
  fastify.get('/matches', {
    onRequest: [fastify.authenticate],
  }, async (request) => {
    const currentUserId = (request.user as { userId: string }).userId;
    
    // Get current user's profile
    const currentProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, currentUserId),
    });
    
    if (!currentProfile) {
      return { matches: [], message: 'Complete your profile first by viewing your top tracks/artists' };
    }
    
    // Get all other users' profiles with their display names
    const otherProfiles = await db
      .select({
        id: userProfiles.id,
        userId: userProfiles.userId,
        topArtists: userProfiles.topArtists,
        topGenres: userProfiles.topGenres,
        topTracks: userProfiles.topTracks,
        displayName: users.displayName,
      })
      .from(userProfiles)
      .innerJoin(users, eq(userProfiles.userId, users.id))
      .where(ne(userProfiles.userId, currentUserId));
    
    // Calculate similarity scores
    const matches = otherProfiles
      .map((profile: any) => ({
        userId: profile.userId,
        displayName: profile.displayName,
        similarity: calculateSimilarity(currentProfile as UserProfileWithUser, profile as UserProfileWithUser),
      }))
      .filter((m: any) => m.similarity > 0)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, 10);
    
    return { matches };
  });
};

export default matchRoutes;