import { pgTable, uuid, text, timestamp, integer, unique, check } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    spotifyId: text('spotify_id').notNull().unique(),
    email: text('email'),
    displayName: text('display_name'),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    tokenExpiry: timestamp('token_expiry'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const tracks = pgTable('tracks', {
    id: uuid('id').primaryKey().defaultRandom(),
    spotifyId: text('spotify_id').notNull().unique(),
    name: text('name').notNull(),
    artist: text('artist').notNull(),
    album: text('album'),
    previewUrl: text('preview_url'),
    imageUrl: text('image_url'),
    durationMs: integer('duration_ms'),
    popularity: integer('popularity'),
});
export const swipes = pgTable('swipes', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    trackId: uuid('track_id')
        .notNull()
        .references(() => tracks.id),
    direction: text('direction').notNull(),
    swipedAt: timestamp('swiped_at').defaultNow().notNull(),
}, (t) => ({
    uniqueUserTrack: unique().on(t.userId, t.trackId),
    directionCheck: check("swipe_direction_check", sql `${t.direction} IN ('left', 'right')`),
}));
export const playlists = pgTable('playlists', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    spotifyPlaylistId: text('spotify_playlist_id').notNull(),
    name: text('name').notNull().default('Sptinder'),
    syncedAt: timestamp('synced_at'),
});
// Relations - for db.query API
export const usersRelations = relations(users, ({ many }) => ({
    swipes: many(swipes),
    playlists: many(playlists),
}));
export const tracksRelations = relations(tracks, ({ many }) => ({
    swipes: many(swipes),
}));
export const swipesRelations = relations(swipes, ({ one }) => ({
    user: one(users, {
        fields: [swipes.userId],
        references: [users.id],
    }),
    track: one(tracks, {
        fields: [swipes.trackId],
        references: [tracks.id],
    }),
}));
export const playlistsRelations = relations(playlists, ({ one }) => ({
    user: one(users, {
        fields: [playlists.userId],
        references: [users.id],
    }),
}));
// Export all schema including relations for query API
export const schema = {
    users,
    tracks,
    swipes,
    playlists,
    usersRelations,
    tracksRelations,
    swipesRelations,
    playlistsRelations,
};
