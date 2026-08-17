# Sptinder - Unified Deployment

FROM node:22-alpine AS base
WORKDIR /app

# Build API
FROM base AS api-builder
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./
RUN npx tsc

# Build Web
FROM base AS web-builder
WORKDIR /app/apps/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/src ./src
COPY apps/web/index.html ./
COPY apps/web/tsconfig.json ./
COPY apps/web/vite.config.ts ./
COPY apps/web/tailwind.config.js ./
RUN npm run build

# Production image - API + nginx for web
FROM node:22-alpine AS api
WORKDIR /app
RUN npm install -g serve
COPY --from=api-builder /app/apps/api/dist ./dist
COPY apps/api/package*.json ./
RUN npm ci --production

# Web server with nginx
FROM nginx:alpine AS web
COPY --from=web-builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EOF