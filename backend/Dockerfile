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
# --ignore-scripts prevents postinstall (npx prisma generate) from running
# here — the Prisma client is already generated in the builder stage and
# copied below, so regenerating would fail (prisma CLI is a devDependency).
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy Prisma schema + generated client from builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled NestJS app
COPY --from=builder /app/dist ./dist

EXPOSE 8080

# Start the app directly (skip prisma db push at runtime to avoid blocking startup)
CMD ["node", "dist/main"]
