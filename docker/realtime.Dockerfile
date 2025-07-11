# ========================================
# Base Stage: Alpine Linux with Bun
# ========================================
FROM oven/bun:alpine AS base

# ========================================
# Dependencies Stage: Install Dependencies
# ========================================
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install turbo globally
RUN bun install -g turbo

COPY package.json bun.lock ./
RUN mkdir -p apps
COPY apps/flowai/package.json ./apps/flowai/package.json

RUN bun install --omit dev --ignore-scripts

# ========================================
# Builder Stage: Build the Application
# ========================================
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ========================================
# Runner Stage: Run the Socket Server
# ========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy the entire sim app since socket-server has dependencies on other modules
COPY --from=builder /app/apps/flowai ./apps/flowai
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose socket server port (default 3002, but configurable via PORT env var)
EXPOSE 3002z
ENV PORT=3002 \
    SOCKET_PORT=3002 \
    HOSTNAME="0.0.0.0"

# Run the socket server directly
CMD ["bun", "apps/flowai/socket-server/index.ts"]