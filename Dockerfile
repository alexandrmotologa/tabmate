# Multi-stage Dockerfile for TabMate

# Stage 1: Build React Telegram Mini App
FROM node:22-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Build TypeScript Server
FROM node:22-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/tabmate.db

# Install server production dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy compiled artifacts
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=web-builder /app/web/dist ./web/dist

# Persistent data directory for SQLite
RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "server/dist/index.js"]
