# syntax=docker/dockerfile:1

# ---- deps + build (also used by the `api-test` compose service) -------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json vitest.config.mts ./
COPY src ./src
COPY migrations ./migrations
COPY tests ./tests
RUN npm run build

# ---- production image ---------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
