# Syntax=docker/dockerfile:1

ARG NODE_VERSION=20.10.0

# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Install ALL dependencies (dev included, needed for nest CLI + prisma generate)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npx nest build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package files and install production deps only.
# NODE_ENV=production is already set above — postinstall checks this and
# skips `prisma generate` automatically (Prisma client is already built
# in Stage 1 and copied below; prisma CLI is a devDependency anyway).
COPY package*.json ./
RUN npm ci --omit=dev

# Copy Prisma schema + generated client from builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Copy prisma CLI so we can run migrate deploy at startup
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy compiled NestJS app
COPY --from=builder /app/dist ./dist

EXPOSE 8080

# Run pending migrations then start the app
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main"]
