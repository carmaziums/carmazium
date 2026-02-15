# Syntax=docker/dockerfile:1

ARG NODE_VERSION=20.10.0

# Stage 1: Build
FROM node:${NODE_VERSION}-alpine as builder

WORKDIR /usr/src/app

# Install dependencies for build (including devDependencies for Nest CLI)
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev) to run build and prisma generate
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and Build the application
RUN npx prisma generate
RUN npx nest build

# Stage 2: Production
FROM node:${NODE_VERSION}-alpine as runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy package.json and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --include=dev
# Note: We include dev deps briefly to ensure prisma CLI is available for 'db push' if needed in start script, 
# or we can rely on it being in 'dependencies' (which validatd earlier). 
# Since we moved @nestjs/cli to dependencies, let's stick to production install if possible, 
# but we need 'prisma' CLI which is usually dev.
# Let's check package.json: prisma is in devDependencies?
# Yes, usually. So we might need to install dev deps or move prisma to dependencies.
# The user moved @nestjs/cli to dependencies. @prisma/client is in dependencies.
# 'prisma' CLI is in devDependencies.
# To run 'prisma db push' at runtime, we need 'prisma' CLI.
# Option A: Install all deps. Option B: Move prisma to dependencies.
# Let's use 'npm ci' (all deps) for now or install prisma global?
# Better: Install production deps, then prune?
# Actually, if we use multistage, the 'runner' stage needs to be able to run 'npx prisma'.
# If 'prisma' package is devDev, it won't be in 'npm ci --only=production'.
# I will use Install ALL dependencies for now to be safe, or just rely on the user's package.json.
# Installing all deps increases image size but ensures stability.
# Let's try to keep it lean. I will run 'npm ci' (all) then prune? No, complex.
# I'll just change the runner to install all dependencies for simplicity and reliability given the 'prisma db push' requirement.
RUN npm ci

# Copy built assets from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
# We don't need to copy node_modules if we ran npm ci above.

# Expose the port the app runs on
EXPOSE 8080

# Environment variables (defaults, can be overridden by Fly.io secrets)
ENV PORT=8080

# Start the application with DB push
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run start:prod"]
