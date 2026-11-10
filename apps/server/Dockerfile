# syntax=docker/dockerfile:1
#
# API server image (API + workers + Socket.IO in one process).
# Build from the REPOSITORY ROOT so the workspace lockfile is used:
#
#   docker build -f apps/server/Dockerfile -t apexmonitor-server .
#
# Configuration comes only from environment variables (see docs/reference/configuration.md);
# no .env file is copied into the image. Database migrations are not run by the image.

ARG NODE_IMAGE=node:24-alpine

# ---------------------------------------------------------------------------
# Workspace manifests only, so dependency layers stay cached until a
# package.json or the lockfile changes.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/sdk/package.json packages/sdk/
COPY packages/browser-sdk/package.json packages/browser-sdk/

# ---------------------------------------------------------------------------
# Build: all server dependencies (incl. dev), type check, esbuild bundle.
# ---------------------------------------------------------------------------
FROM manifests AS build
RUN npm ci --workspace=apps/server --no-audit --no-fund
COPY apps/server/tsconfig.json apps/server/build.mjs apps/server/
COPY apps/server/src apps/server/src
RUN npm run build --workspace=apps/server

# ---------------------------------------------------------------------------
# Production dependencies only (the bundle keeps node_modules external).
# ---------------------------------------------------------------------------
FROM manifests AS prod-deps
RUN npm ci --workspace=apps/server --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app ./
COPY --from=build --chown=node:node /app/apps/server/dist apps/server/dist
WORKDIR /app/apps/server
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" >/dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/bootstrap.js"]
