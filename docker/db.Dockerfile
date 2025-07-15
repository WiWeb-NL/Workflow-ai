# ========================================
# Dependencies Stage: Install Dependencies
# ========================================
FROM oven/bun:alpine AS deps
WORKDIR /app

# Copy only package files needed for migrations
COPY package.json bun.lock turbo.json ./
COPY apps/flowai/package.json ./apps/flowai/db/

# Install minimal dependencies in one layer
RUN bun install --omit dev --ignore-scripts && \
    bun install --omit dev --ignore-scripts drizzle-kit drizzle-orm postgres next-runtime-env zod @t3-oss/env-nextjs

# ========================================
# Runner Stage: Production Environment
# ========================================
FROM oven/bun:alpine AS runner
WORKDIR /app

# Copy only the necessary files from deps
COPY --from=deps /app/node_modules ./node_modules
COPY apps/flowai/drizzle.config.ts ./apps/flowai/drizzle.config.ts
COPY apps/flowai/db ./apps/flowai/db
COPY apps/flowai/package.json ./apps/flowai/package.json
COPY apps/flowai/lib/env.ts ./apps/flowai/lib/env.ts

WORKDIR /app/apps/flowai