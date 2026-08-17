# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY apps/web/package.json ./
COPY package.json ./package.json

# Install dependencies
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY apps/web/ ./

# Build
RUN npm run build

# Production stage - using nginx alpine
FROM nginx:alpine AS runner

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]