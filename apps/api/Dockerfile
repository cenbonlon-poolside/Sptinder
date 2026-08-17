# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./package.json
COPY apps/api/package*.json ./
COPY apps/api/ ./apps/api/
COPY tsconfig.json ./tsconfig.json
RUN npm install
RUN npx tsc

# Production stage
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
RUN npm install --production
EXPOSE 3000
CMD ["node", "dist/index.js"]