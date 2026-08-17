# Sptinder — Architecture

> **"Spotify Music Tinder"** — a music-dating app where users swipe on songs, get matched
> with people who share their taste, chat live, and co-create collaborative playlists.
> Built as a microservices stack on Node.js/TypeScript, deployed to Kubernetes with Helm.

## Overview

Sptinder is a single monorepo containing four cooperating services plus deployment
and monitoring tooling. Every service is Node.js + TypeScript and they share two
backing systems: **PostgreSQL** (data + Prisma ORM) and **Redis** (caching,
Socket.IO state, and the BullMQ job broker).

```
Sptinder/
├── services/
│   ├── api/        # REST API  (Express, port 4000)
│   ├── realtime/   # WebSockets (Socket.IO, port 4001)
│   ├── worker/     # Background jobs (BullMQ, port 4002)
│   └── frontend/   # React SPA (CRA, Material-UI, port 3000)
├── infrastructure/  # Helm chart + k8s manifests + Prometheus/Grafana
├── docker-compose.yml   # Local dev: api + realtime + worker + frontend + infra
├── .github/workflows/ci-cd.yml
├── setup.sh          # One-shot local bootstrap
└── duplicate_finder.py # Repo hygiene script
```

## Services

| Service | Runtime | Port | Responsibility |
|---------|---------|------|----------------|
| **Frontend** | React 18, CRA, MUI | 3000 | Auth gate, swipe deck, matches list, chat UI, profile/playlist UI |
| **API** | Node/Express | 4000 | REST `/api/v1/{auth,songs,swipes,matches,users}`, JWT auth, Spotify calls, Prisma |
| **Realtime** | Node/Socket.IO | 4001 | Live chat presence, match/swipe push notifications, match-room broadcasting |
| **Worker** | Node/BullMQ | 4002 | `recommendations` & `playlists` job queues; hits Spotify on behalf of users |

Shared infrastructure
(also spun up by `docker-compose.yml` for local dev):
- **PostgreSQL** (15) — primary store, schema managed by Prisma migrations.
- **Redis** (7) — session/state cache, Socket.IO adapter backplane, BullMQ queue backend.
- **Prometheus** (9090) + **Grafana** (3001) — metrics & dashboards.

## Data model

Core entities (Prisma, `services/api/prisma/schema.prisma`):

- **User** — identity; stores the Spotify OAuth access/refresh tokens + expiry.
- **Song** + **AudioFeatures** — catalog of songs surfaced to the deck
  (`previewUrl` is what the client plays the 30-second preview from).
- **Swipe** — `(userId, songId, direction)` unique pair; the deck feed excludes
  songs the user has already swiped.
- **Match** — `(userId, matchedUserId)`; created when two users' `like` sets
  overlap by ≥3 songs.
- **ChatMessage** — `messageType` of `text`/`song`/`playlist` with a JSON `metadata`
  column, attached to a Match; drives the chat UI.
- **Playlist** — user-owned collaborative playlists synced with Spotify.
- **Recommendation** — scored suggestions per user (currently populated by the worker).

## Request flow

All REST traffic hits the API. Each request passes through a layered middleware
pipeline (`src/index.ts`):

```
helmet → cors → rate-limit → morgan(winston) → express.json → /api/v1 routes
      → notFoundHandler → errorHandler (centralized AppError)
```

### 1. Sign in
1. Frontend (`AuthContext`) finds no JWT → renders `Login`.
2. `Login` → `GET /auth/spotify` → API builds a Spotify authorize URL and returns it.
3. Browser is redirected to Spotify; Spotify redirects back with a `code`.
4. Frontend → `POST /auth/exchange { code }`, which API uses to call Spotify
   (`authorizationCodeGrant`), fetch the profile (`getMe`), upsert the `User`
  (caching Spotify tokens), and return a signed **JWT**.
5. Frontend stores the JWT in `localStorage`, then `GET /auth/me`
   (`authenticateToken` middleware verifies the JWT → `req.user`) hydrates the session.
6. `SocketContext` opens a Socket.IO connection to the Realtime service,
   authenticating with the same JWT.

### 2. Swipe + match
1. `Swipe` page → `GET /songs?limit=N` → `getSongsForSwiping`:
   excludes already-swiped songs, reads from the DB, and — if the cache is thin —
   uses the user's Spotify token to call Recommendations and persist new
   `Song`/`AudioFeatures` rows.
2. On a like/dislike → `POST /swipes { songId, direction }`:
   upserts the `Swipe`. For a `like`, the controller runs an in-request
   matching algorithm — finds other users who liked the same song, intersects
   liked-song sets, and creates a `Match` when ≥3 songs are shared.
3. The response carries `{ swipe, match? }`, so the frontend can react
   immediately; the Realtime service's `match`/`swipeNotification` socket events
   are available for live fan-out.

### 3. Live chat
- REST persists: `POST /matches/:matchId/messages` writes a `ChatMessage`.
- Realtime broadcasts: the RT service joins each user to `match:<id>` rooms and
  fans `newMessage` out to the room so the peer updates instantly.
- `Chat` loads history over REST on mount and subscribes to `newMessage` over
  the socket; `typing` events relay presence.
- `Matches` keeps its list fresh by listening for `newMessage` / `newMatch`.

### 4. Profile & playlists
- `GET/PUT /users/profile` reads/updates the user.
- `GET /users/playlists` merges the user's Spotify playlists (via their access
  token) with Sptinder collaborative playlists from the DB.
- `POST /users/playlists` creates a playlist on Spotify and records it locally.

### 5. Background jobs
- The Worker hosts two **BullMQ** workers on Redis queues:
  - `recommendationWorker` (`recommendations` queue) — derives top genres/artists
    from a user's swipes, calls Spotify Recommendations, and stores new songs.
  - `playlistWorker` (`playlists` queue) — on a match, combines both users'
    liked songs (deduplicated), creates a collaborative playlist on Spotify,
    and records it.
- Queues + hourly old-job cleanup are configured in `queues/queueSetup.ts`.

## Deployment & CI/CD

- **Local**: `docker-compose up -d` (or `./setup.sh`) runs all services with
  Postgres/Redis/Prometheus/Grafana. Per-service `npm run dev` uses `ts-node-dev`.
- **Staging/Prod**: Helm chart under `infrastructure/helm` renders per-service
  Deployments + Services, an ingress, an HPA, and a secrets template. Raw k8s
  manifests live under `infrastructure/kubernetes`.
- **CI/CD** (`.github/workflows/ci-cd.yml`): per-service lint + Jest on PRs; on
  merge to `main` builds/pushes images to ghcr.io and deploys to production
  (with a `npm run migrate` step against the API pod); `develop` → staging.

## Configuration

All secrets are environment variables validated at boot (`config/index.ts`):
`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `DATABASE_URL`, `REDIS_URL`,
`JWT_SECRET`. Copy `.env.example` → `.env` per service. The root `.env.example`
lists the full matrix and the OAuth redirect URI.

## Known gaps (to reconcile before production use)

- **Schema drift between services.** The worker has its own Prisma schema
  (`services/worker/prisma/schema.prisma`) that references fields/relations the
  API schema does not: `swipe.action` (vs `swipe.direction`),
  `song.artistName` (vs `song.artist`), `Match.user1/user2` (vs `user`/`matchedUser`),
  and a `CollaborativePlaylist` model absent from the API schema. These must be
  unified so the worker can run against the shared DB.
- **No queue producer wired up.** The API/workers consume from
  `recommendations` and `playlists` queues, but no code currently *enqueues*
  jobs (e.g. after a match or on a schedule).
- **Auth callback mismatch.** `AuthContext.login` decodes the `user` from the JWT
  payload (`payload.user`), but the API signs `{ userId, spotifyId }` with no
  `user` field — so the in-app user object is empty until `GET /auth/me` runs.
