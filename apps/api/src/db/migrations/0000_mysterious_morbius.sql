CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"spotify_playlist_id" text NOT NULL,
	"name" text DEFAULT 'Sptinder' NOT NULL,
	"synced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "swipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"swiped_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "swipes_user_id_track_id_unique" UNIQUE("user_id","track_id"),
	CONSTRAINT "swipe_direction_check" CHECK ("swipes"."direction" IN ('left', 'right'))
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spotify_id" text NOT NULL,
	"name" text NOT NULL,
	"artist" text NOT NULL,
	"album" text,
	"preview_url" text,
	"image_url" text,
	"duration_ms" integer,
	"popularity" integer,
	CONSTRAINT "tracks_spotify_id_unique" UNIQUE("spotify_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spotify_id" text NOT NULL,
	"email" text,
	"display_name" text,
	"refresh_token" text,
	"access_token" text,
	"token_expiry" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_spotify_id_unique" UNIQUE("spotify_id")
);
--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;