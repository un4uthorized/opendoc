# One image with the API and the built web app. The API (Node 24 runs its TypeScript directly)
# serves /api and the front end on the same port.
#
#   podman build -t opendoc .
#   podman run --env-file .env -p 4173:4173 opendoc
#
# PostgreSQL runs apart (DATABASE_URL). Migrations run when the container starts.

ARG NODE_VERSION=24.18.0

# ── Dependencies (cached while the manifests don't change) ───────────
FROM docker.io/library/node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ── Web build (type check + Vite) ────────────────────────────────────
FROM deps AS web
COPY apps/web apps/web
RUN pnpm --filter @opendoc/web build

# ── API: production dependencies only ────────────────────────────────
FROM docker.io/library/node:${NODE_VERSION}-alpine AS api-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --filter @opendoc/api...

# ── Runtime ──────────────────────────────────────────────────────────
FROM docker.io/library/node:${NODE_VERSION}-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173 \
    WEB_DIR=/app/web
COPY --from=api-deps /app/node_modules ./node_modules
COPY --from=api-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/migrations apps/api/migrations
COPY --from=web /app/apps/web/dist ./web
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
WORKDIR /app/apps/api
CMD ["node", "src/index.ts"]
