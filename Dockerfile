# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json tsconfig.json tsconfig.test.json vitest.config.ts ./
COPY src ./src
COPY tests ./tests
COPY scripts ./scripts
# ADR 0006: operator control plane assets are mirrored into dist/ by
# scripts/copy-runtime-assets.mjs and served at runtime under /ui/.
COPY docs/control-plane ./docs/control-plane
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Non-root user (drop privileges; M0 baseline hardening).
ENV LOG_FILE_PATH=/var/log/orchestrator/orchestrator.log
RUN groupadd --system orchestrator \
  && useradd --system --gid orchestrator --home-dir /app orchestrator \
  && mkdir -p /var/log/orchestrator \
  && chown -R orchestrator:orchestrator /var/log/orchestrator /app
USER orchestrator

COPY --from=build --chown=orchestrator:orchestrator /app/node_modules ./node_modules
COPY --from=build --chown=orchestrator:orchestrator /app/dist ./dist
COPY --from=build --chown=orchestrator:orchestrator /app/package.json ./package.json

# MCP transport (3000) + mgmt API (3001) + webhook ingress (3002).
# Mgmt is bound to 127.0.0.1 inside the container by default; expose only if
# the deployment intentionally publishes the mgmt port to the host network.
EXPOSE 3000 3001 3002

# Healthcheck hits the mgmt /health/live alias on 3001 inside the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
