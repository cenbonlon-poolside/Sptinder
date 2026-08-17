# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY apps/api/package.json ./
COPY package.json ./package.json

# Install dependencies
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY apps/api/ ./

# Build
RUN npm run build

# Production stage - using distroless
FROM gcr.io/distroless/nodejs22-debian12 AS runner

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["dist/index.js"]