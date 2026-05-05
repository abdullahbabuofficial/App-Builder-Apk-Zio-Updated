# syntax=docker/dockerfile:1.7
# Multi-stage build for the PushCare APK builder.
#
# Stage 1: install deps + compile TypeScript.
# Stage 2: production image — only deps and compiled JS, no toolchain.

FROM node:20-alpine AS build

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund

COPY src ./src
COPY templates ./templates
RUN npx tsc -p tsconfig.json

# ---------------------------------------------------------------------

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
 && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/templates ./templates

# Non-root for safety.
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8090/healthz || exit 1

CMD ["node", "dist/index.js"]
