# syntax=docker/dockerfile:1
#
# Explicit build targets:
#   runtime            = public HTTP API; NO Prisma CLI or migration tooling
#   prisma-maintenance = on-demand CLI-only maintenance; NEVER a public service
#
# Build: docker build --target runtime -t carmazium-backend-api .
#        docker build --target prisma-maintenance -t carmazium-prisma-maintenance .
# The default final stage remains runtime for existing Fly deployments.
ARG NODE_IMAGE=node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate && npx nest build

# This separate image can execute the Prisma CLI for explicitly authorised,
# auditable database maintenance. Never expose ports or start it persistently.
# The production schema history includes manually applied SQL and is NOT
# certified for arbitrary `prisma migrate deploy`, much less `db push`.
# No database credentials are present at build time or baked into this image.
FROM ${NODE_IMAGE} AS prisma-maintenance
WORKDIR /app
ENV NODE_ENV=production
# Copy CLI tooling and the schema, NOT the compiled HTTP application or its
# business assets. All file changes and DB credentials belong to an
# explicitly approved, private one-off maintenance job.
# A distinct, lockfile-pinned Prisma CLI package avoids inheriting the
# application's dev tools, runtime dependencies or globally bundled npm.
COPY prisma-maintenance/package*.json ./
RUN npm ci --omit=dev --no-fund \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && test -x /app/node_modules/.bin/prisma
COPY prisma ./prisma
USER node
ENTRYPOINT ["/app/node_modules/.bin/prisma"]
CMD ["--version"]

# Public API runtime: no migration CLI or Prisma CLI dependency chain.
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Required for the existing weekly backup implementation; do not modify the
# production backup process while isolating Prisma migrations.
RUN apk upgrade --no-cache && apk add --no-cache postgresql16-client

COPY package*.json ./
# `@prisma/client` has an npm optional Prisma peer; npm still physically
# installs the CLI in our locked production-only tree. Explicitly remove
# ONLY the CLI's verified non-runtime packages. Retain @prisma/client and the
# generated query engine. The CI image-isolation tests validate both.
RUN npm ci --omit=dev --omit=peer --ignore-scripts --no-fund \
 && rm -rf ./node_modules/prisma ./node_modules/@prisma/config ./node_modules/deepmerge-ts \
 && test ! -e ./node_modules/prisma \
 && test ! -e ./node_modules/@prisma/config \
 && test ! -e ./node_modules/deepmerge-ts \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && test ! -e /usr/local/lib/node_modules/npm

# Do not copy /app/node_modules/@prisma wholesale from builder: doing so
# reintroduces Prisma CLI dependencies. The runtime's @prisma/client comes
# from npm ci; copy only the generated Prisma client and its engine.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets
# Existing maintenance scripts remain for backwards-compatible non-Prisma
# operations. Prisma CLI commands must use the maintenance image.
COPY --from=builder /app/scripts ./scripts

# Fail the image build if the generated client is missing or if the CLI
# slipped back into the HTTP image via a future package-lock change.
RUN node -e "const fs=require('node:fs');for(const p of ['node_modules/prisma','node_modules/@prisma/config','node_modules/deepmerge-ts'])if(fs.existsSync(p))throw Error('Forbidden Prisma maintenance dependency: '+p);const c=require('@prisma/client');if(typeof c.PrismaClient!=='function')throw Error('Generated Prisma client missing')"

EXPOSE 8080
CMD ["node", "dist/main"]
