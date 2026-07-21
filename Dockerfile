# syntax=docker/dockerfile:1
# SokoOS API — multi-stage build from monorepo root context:
#   docker build -t sokoos-api .
#   docker compose --profile api up --build

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# Base: Node 22 + pnpm via corepack
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# deps: install workspace graph for @sokoos/api and its package deps
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.base.json turbo.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/sync-protocol/package.json packages/sync-protocol/
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile --filter @sokoos/api...

# ---------------------------------------------------------------------------
# build: compile shared packages + Nest API
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app /app
COPY packages/database packages/database
COPY packages/shared packages/shared
COPY packages/types packages/types
COPY packages/utils packages/utils
COPY packages/sync-protocol packages/sync-protocol
COPY services/api services/api
RUN pnpm --filter @sokoos/api... build

# ---------------------------------------------------------------------------
# production: runtime with built workspace graph
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S sokoos && adduser -S sokoos -G sokoos

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/api/package.json ./services/api/
COPY --from=build /app/services/api/dist ./services/api/dist
COPY --from=build /app/services/api/node_modules ./services/api/node_modules

USER sokoos
WORKDIR /app/services/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
